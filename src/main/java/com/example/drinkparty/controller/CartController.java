package com.example.drinkparty.controller;

import com.example.drinkparty.model.UserCart;
import com.example.drinkparty.model.GroupOrder;
import com.example.drinkparty.repository.UserCartRepository;
import com.example.drinkparty.repository.GroupOrderRepository;
import com.example.drinkparty.service.CartService;
import com.example.drinkparty.exception.SecurityAccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/carts")
@CrossOrigin
public class CartController {

    private final CartService cartService;
    private final UserCartRepository userCartRepository;
    private final GroupOrderRepository groupOrderRepository;

    public CartController(CartService cartService, 
                          UserCartRepository userCartRepository,
                          GroupOrderRepository groupOrderRepository) {
        this.cartService = cartService;
        this.userCartRepository = userCartRepository;
        this.groupOrderRepository = groupOrderRepository;
    }

    /**
     * 自定義例外處理：當越權存取時回傳 403 Forbidden
     */
    @ExceptionHandler(SecurityAccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleSecurityException(SecurityAccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", e.getMessage()));
    }

    /**
     * DTO 用於點餐加入購物車
     */
    public static class AddItemRequest {
        private String groupId;
        private String userId;
        private String userName;
        private String productId;
        private String size;
        private String ice;
        private String sweetness;
        private List<String> toppings;
        private int quantity;

        // Getters and Setters
        public String getGroupId() { return groupId; }
        public void setGroupId(String groupId) { this.groupId = groupId; }

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }

        public String getUserName() { return userName; }
        public void setUserName(String userName) { this.userName = userName; }

        public String getProductId() { return productId; }
        public void setProductId(String productId) { this.productId = productId; }

        public String getSize() { return size; }
        public void setSize(String size) { this.size = size; }

        public String getIce() { return ice; }
        public void setIce(String ice) { this.ice = ice; }

        public String getSweetness() { return sweetness; }
        public void setSweetness(String sweetness) { this.sweetness = sweetness; }

        public List<String> getToppings() { return toppings; }
        public void setToppings(List<String> toppings) { this.toppings = toppings; }

        public int getQuantity() { return quantity; }
        public void setQuantity(int quantity) { this.quantity = quantity; }
    }

    /**
     * 獲取特定人在特定揪團房的個人購物車
     * 防禦性編程：僅限使用者本人或該房間的主揪才可以訪問明細，防禦 BOLA
     */
    @GetMapping("/{groupId}/{userId}")
    public ResponseEntity<?> getUserCart(@PathVariable String groupId, 
                                         @PathVariable String userId,
                                         @RequestHeader(value = "X-User-Id", required = false) String requestUserId) {
        if (requestUserId == null || requestUserId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "未提供用戶識別碼，無權存取！"));
        }

        // 1. 驗證該 requestUserId 的基本房權限
        cartService.validateAccess(groupId, requestUserId);

        // 2. 驗證是否為本人或主揪，防禦 IDOR 橫向越權
        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));

        if (!requestUserId.equals(userId) && !requestUserId.equals(group.getInitiatorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "越權存取：您無權檢視其他人的購物車資料！"));
        }

        return userCartRepository.findByGroupIdAndUserId(groupId, userId)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 加入商品至購物車 (含後端計價防惡意竄改與截止防禦)
     */
    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestHeader(value = "X-User-Id", required = false) String requestUserId,
                                       @RequestBody AddItemRequest req) {
        try {
            GroupOrder group = groupOrderRepository.findById(req.getGroupId())
                .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));

            if (requestUserId == null || (!requestUserId.equals(req.getUserId()) && !requestUserId.equals(group.getInitiatorId()))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "安全驗證失敗：無法以他人身份點餐！"));
            }

            UserCart cart = cartService.addToCart(
                req.getGroupId(),
                req.getUserId(),
                req.getUserName(),
                req.getProductId(),
                req.getSize(),
                req.getIce(),
                req.getSweetness(),
                req.getToppings(),
                req.getQuantity()
            );
            return ResponseEntity.ok(cart);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 從個人購物車中移除品項
     */
    @PostMapping("/remove")
    public ResponseEntity<?> removeFromCart(@RequestHeader(value = "X-User-Id", required = false) String requestUserId,
                                            @RequestBody Map<String, Object> payload) {
        try {
            String groupId = (String) payload.get("groupId");
            String userId = (String) payload.get("userId");
            Number itemIdNum = (Number) payload.get("itemId");
            Long itemId = itemIdNum.longValue();

            GroupOrder group = groupOrderRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));

            if (requestUserId == null || (!requestUserId.equals(userId) && !requestUserId.equals(group.getInitiatorId()))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "安全驗證失敗：無法修改他人的購物車！"));
            }

            UserCart cart = cartService.removeFromCart(groupId, userId, itemId);
            return ResponseEntity.ok(cart);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 提交並鎖定購物車
     */
    @PostMapping("/submit")
    public ResponseEntity<?> submitCart(@RequestHeader(value = "X-User-Id", required = false) String requestUserId,
                                        @RequestBody Map<String, String> payload) {
        try {
            String groupId = payload.get("groupId");
            String userId = payload.get("userId");

            GroupOrder group = groupOrderRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));

            if (requestUserId == null || (!requestUserId.equals(userId) && !requestUserId.equals(group.getInitiatorId()))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "安全驗證失敗：無法代為提交他人購物車！"));
            }

            UserCart cart = cartService.submitCart(groupId, userId);
            return ResponseEntity.ok(cart);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 解鎖購物車以進行修改
     */
    @PostMapping("/unlock")
    public ResponseEntity<?> unlockCart(@RequestHeader(value = "X-User-Id", required = false) String requestUserId,
                                        @RequestBody Map<String, String> payload) {
        try {
            String groupId = payload.get("groupId");
            String userId = payload.get("userId");

            GroupOrder group = groupOrderRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));

            if (requestUserId == null || (!requestUserId.equals(userId) && !requestUserId.equals(group.getInitiatorId()))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "安全驗證失敗：無法代為修改他人購物車！"));
            }

            UserCart cart = cartService.unlockCart(groupId, userId);
            return ResponseEntity.ok(cart);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
