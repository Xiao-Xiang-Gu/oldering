package com.example.drinkparty.service;

import com.example.drinkparty.model.*;
import com.example.drinkparty.repository.*;
import com.example.drinkparty.exception.SecurityAccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class CartService {

    private final GroupOrderRepository groupOrderRepository;
    private final UserCartRepository userCartRepository;
    private final ProductRepository productRepository;
    private final CustomOptionRepository customOptionRepository;
    private final CartItemRepository cartItemRepository;

    public CartService(GroupOrderRepository groupOrderRepository,
                       UserCartRepository userCartRepository,
                       ProductRepository productRepository,
                       CustomOptionRepository customOptionRepository,
                       CartItemRepository cartItemRepository) {
        this.groupOrderRepository = groupOrderRepository;
        this.userCartRepository = userCartRepository;
        this.productRepository = productRepository;
        this.customOptionRepository = customOptionRepository;
        this.cartItemRepository = cartItemRepository;
    }

    /**
     * 驗證使用者是否有存取該揪團訂單的權限 (防禦非受邀跟團者/主揪以外越權訪問)
     */
    @Transactional(readOnly = true)
    public void validateAccess(String groupId, String userId) {
        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));
            
        // 0. 如果房間為 private，且不是主揪本人，拒絕存取
        if ("private".equals(group.getStatus()) && !group.getInitiatorId().equals(userId)) {
            throw new SecurityAccessDeniedException("主揪尚未開放此揪團房間，無權訪問此訂單資料！");
        }
        
        // 1. 如果是主揪本人，放行
        if (group.getInitiatorId().equals(userId)) {
            return;
        }
        
        // 2. 如果是已經註冊暱稱並建立 UserCart 紀錄的跟團者，放行
        boolean isMember = userCartRepository.findByGroupIdAndUserId(groupId, userId).isPresent();
        if (!isMember) {
            throw new SecurityAccessDeniedException("您未加入此揪團房間，無權訪問此訂單資料！請先註冊您的名字。");
        }
    }

    /**
     * 跟團者加入揪團房間 (正式註冊其 userId 成為合法成員)
     */
    @Transactional
    public UserCart joinGroup(String groupId, String userId, String userName) {
        if (userName == null || userName.trim().isEmpty()) {
            throw new IllegalArgumentException("暱稱不得為空！");
        }
        if (userName.trim().length() > 20) {
            throw new IllegalArgumentException("暱稱長度上限為 20 個字！");
        }

        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));
            
        if ("private".equals(group.getStatus())) {
            throw new IllegalStateException("該揪團尚未開放加入！");
        } else if (!"active".equals(group.getStatus())) {
            throw new IllegalStateException("該揪團已經截止點餐，無法再加入！");
        }

        // 若已經有註冊紀錄，如果暱稱不同則更新，否則直接返回
        Optional<UserCart> existing = userCartRepository.findByGroupIdAndUserId(groupId, userId);
        if (existing.isPresent()) {
            UserCart cart = existing.get();
            String trimmedName = userName.trim();
            if (!trimmedName.equals(cart.getUserName())) {
                cart.setUserName(trimmedName);
                return userCartRepository.save(cart);
            }
            return cart;
        }

        // 建立新跟團者購物車紀錄
        UserCart newCart = new UserCart(groupId, userId, userName.trim(), "pending");
        return userCartRepository.save(newCart);
    }

    /**
     * 加入商品至個人購物車 (後端防禦性編程與計價)
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public UserCart addToCart(String groupId, String userId, String userName, String productId,
                              String size, String ice, String sweetness, List<String> toppings, int quantity) {
        // null 防護：若前端未傳 toppings，改為空列表
        if (toppings == null) toppings = new ArrayList<>();
        
        // 安全防禦: 驗證當前請求者的存取權限
        validateAccess(groupId, userId);

        // 防禦 1: 驗證數量是否大於 0，且不得大於 100 杯
        if (quantity <= 0) {
            throw new IllegalArgumentException("數量必須大於 0！");
        }
        if (quantity > 100) {
            throw new IllegalArgumentException("單次加點數量不得大於 100 杯！");
        }

        // 防禦 2: 驗證房間狀態，如果已截止點餐則拒絕寫入
        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));
            
        if (!"active".equals(group.getStatus()) && !"private".equals(group.getStatus())) {
            throw new IllegalStateException("該揪團已經截止或處理中，無法再加入新商品！");
        }

        // 防禦 3: 價格由後端決定，禁止聽信前端傳來的價格
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new IllegalArgumentException("商品不存在！"));
            
        // 防禦 3.2: 檢查限量商品庫存是否足夠並扣減
        if (product.getInventory() != null) {
            if (product.getInventory() < quantity) {
                throw new IllegalArgumentException("商品庫存不足，僅剩 " + product.getInventory() + " 杯！");
            }
            product.setInventory(product.getInventory() - quantity);
            productRepository.save(product);
        }
            
        // 防禦 3.5: 驗證客製化規格與加料選項的合法性
        List<CustomOption> allOptions = product.getCustomOptions();
        
        List<String> validSizes = allOptions.stream()
            .filter(o -> "SIZE".equals(o.getType()))
            .map(CustomOption::getName)
            .toList();
            
        List<String> validIces = allOptions.stream()
            .filter(o -> "ICE".equals(o.getType()))
            .map(CustomOption::getName)
            .toList();
            
        List<String> validSweetnesses = allOptions.stream()
            .filter(o -> "SWEETNESS".equals(o.getType()))
            .map(CustomOption::getName)
            .toList();
            
        List<String> validToppings = allOptions.stream()
            .filter(o -> "TOPPING".equals(o.getType()))
            .map(CustomOption::getName)
            .toList();

        // 1. 驗證容量 (SIZE)
        if (!validSizes.isEmpty()) {
            if (size == null || size.isEmpty() || !validSizes.contains(size)) {
                throw new IllegalArgumentException("不支援此容量規格：" + size);
            }
        } else {
            if (size != null && !size.isEmpty()) {
                throw new IllegalArgumentException("此商品不支援選擇容量規格！");
            }
        }

        // 2. 驗證冰塊 (ICE)
        if (!validIces.isEmpty()) {
            if (ice == null || ice.isEmpty() || !validIces.contains(ice)) {
                throw new IllegalArgumentException("不支援此冰塊選項：" + ice);
            }
        } else {
            if (ice != null && !ice.isEmpty()) {
                throw new IllegalArgumentException("此商品不支援選擇冰塊選項！");
            }
        }

        // 3. 驗證甜度 (SWEETNESS)
        if (!validSweetnesses.isEmpty()) {
            if (sweetness == null || sweetness.isEmpty() || !validSweetnesses.contains(sweetness)) {
                throw new IllegalArgumentException("不支援此甜度選項：" + sweetness);
            }
        } else {
            if (sweetness != null && !sweetness.isEmpty()) {
                throw new IllegalArgumentException("此商品不支援選擇甜度選項！");
            }
        }

        // 4. 驗證加料 (TOPPING)
        for (String toppingName : toppings) {
            if (!validToppings.contains(toppingName)) {
                throw new IllegalArgumentException("不支援此加料選項：" + toppingName);
            }
        }

        double calculatedPrice = product.getBasePrice();

        // 查詢容量加價
        if (size != null && !size.isEmpty()) {
            Optional<CustomOption> sizeOpt = customOptionRepository.findByProduct_IdAndName(productId, size);
            if (sizeOpt.isPresent()) {
                calculatedPrice += sizeOpt.get().getExtraPrice();
            }
        }

        // 獲取該使用者的購物車；若主揪的購物車因任何原因不存在，自動補建（容錯修復）
        final String resolvedUserName = userName;
        UserCart userCart = userCartRepository.findByGroupIdAndUserId(groupId, userId)
            .orElseGet(() -> {
                // 確認是主揪才允許自動建立
                GroupOrder g = groupOrderRepository.findById(groupId)
                    .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));
                if (!g.getInitiatorId().equals(userId)) {
                    throw new IllegalStateException("未找到您的加入紀錄，請先點擊加入房間！");
                }
                return userCartRepository.save(new UserCart(groupId, userId,
                    resolvedUserName != null ? resolvedUserName : "主揪", "pending"));
            });

        // 防禦 4: 如果購物車已經提交鎖定，則拒絕修改
        if ("submitted".equals(userCart.getStatus())) {
            throw new IllegalStateException("購物車已提交鎖定，請先點擊「修改餐點」解鎖！");
        }

        // 尋找是否已有相同規格商品，若有則累加
        CartItem existingItem = null;
        for (CartItem item : userCart.getItems()) {
            if (item.getProductId().equals(productId) &&
                item.getSize().equals(size) &&
                item.getIce().equals(ice) &&
                item.getSweetness().equals(sweetness)) {
                
                // 比對配料是否完全相同
                List<String> itemToppings = new ArrayList<>();
                for (CartTopping t : item.getToppings()) {
                    itemToppings.add(t.getToppingName());
                }
                
                if (itemToppings.size() == toppings.size() && itemToppings.containsAll(toppings)) {
                    existingItem = item;
                    break;
                }
            }
        }

        if (existingItem != null) {
            existingItem.setQuantity(existingItem.getQuantity() + quantity);
            cartItemRepository.save(existingItem);
        } else {
            CartItem newItem = new CartItem(
                userCart,
                productId,
                product.getName(),
                size,
                ice,
                sweetness,
                calculatedPrice,
                quantity
            );
            
            // 寫入加料明細，同樣由後端查表計價
            List<CartTopping> cartToppings = new ArrayList<>();
            for (String toppingName : toppings) {
                double toppingPrice = 0;
                Optional<CustomOption> topOpt = customOptionRepository.findByProduct_IdAndName(productId, toppingName);
                if (topOpt.isPresent()) {
                    toppingPrice = topOpt.get().getExtraPrice();
                }
                
                // 同時把加料的價錢加到這杯飲料的單價中，以便統一計算
                newItem.setPrice(newItem.getPrice() + toppingPrice);
                cartToppings.add(new CartTopping(newItem, toppingName, toppingPrice));
            }
            newItem.setToppings(cartToppings);
            userCart.getItems().add(newItem);
            
            userCartRepository.save(userCart);
        }

        return userCart;
    }

    /**
     * 刪除購物車品項 (防禦性編程)
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public UserCart removeFromCart(String groupId, String userId, Long itemId) {
        // 安全防禦: 驗證存取權限
        validateAccess(groupId, userId);

        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));
            
        if (!"active".equals(group.getStatus()) && !"private".equals(group.getStatus())) {
            throw new IllegalStateException("該揪團已截止，無法刪除商品！");
        }

        UserCart userCart = userCartRepository.findByGroupIdAndUserId(groupId, userId)
            .orElseThrow(() -> new IllegalArgumentException("找不到您的購物車！"));

        if ("submitted".equals(userCart.getStatus())) {
            throw new IllegalStateException("您的購物車已鎖定，請先解鎖！");
        }

        // 尋找要被移除的品項以退還庫存
        CartItem targetItem = userCart.getItems().stream()
            .filter(item -> item.getId().equals(itemId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("購物車中無此品項！"));

        Product product = productRepository.findById(targetItem.getProductId())
            .orElseThrow(() -> new IllegalArgumentException("商品不存在！"));

        if (product.getInventory() != null) {
            product.setInventory(product.getInventory() + targetItem.getQuantity());
            productRepository.save(product);
        }

        userCart.getItems().remove(targetItem);
        return userCartRepository.save(userCart);
    }

    /**
     * 提交並鎖定購物車
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public UserCart submitCart(String groupId, String userId) {
        // 安全防禦: 驗證存取權限
        validateAccess(groupId, userId);

        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));
            
        if (!"active".equals(group.getStatus()) && !"private".equals(group.getStatus())) {
            throw new IllegalStateException("該揪團已截止或處理中，無法提交購物車！");
        }

        UserCart userCart = userCartRepository.findByGroupIdAndUserId(groupId, userId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該購物車，無法提交！"));
            
        if (userCart.getItems().isEmpty()) {
            throw new IllegalStateException("購物車沒有任何飲品，無法提交！");
        }

        userCart.setStatus("submitted");
        return userCartRepository.save(userCart);
    }

    /**
     * 解鎖購物車 (防禦性編程：截止點餐後不可解鎖)
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public UserCart unlockCart(String groupId, String userId) {
        // 安全防禦: 驗證存取權限
        validateAccess(groupId, userId);

        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));
            
        if (!"active".equals(group.getStatus()) && !"private".equals(group.getStatus())) {
            throw new IllegalStateException("該揪團已經截止，無法解鎖修改！");
        }

        UserCart userCart = userCartRepository.findByGroupIdAndUserId(groupId, userId)
            .orElseThrow(() -> new IllegalArgumentException("找不到您的購物車！"));

        userCart.setStatus("pending");
        return userCartRepository.save(userCart);
    }
}
