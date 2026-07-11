package com.example.drinkparty.service;

import com.example.drinkparty.model.GroupOrder;
import com.example.drinkparty.model.UserCart;
import com.example.drinkparty.model.Store;
import com.example.drinkparty.repository.GroupOrderRepository;
import com.example.drinkparty.repository.UserCartRepository;
import com.example.drinkparty.repository.StoreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class GroupOrderService {

    private final GroupOrderRepository groupOrderRepository;
    private final UserCartRepository userCartRepository;
    private final StoreRepository storeRepository;

    public GroupOrderService(GroupOrderRepository groupOrderRepository, 
                             UserCartRepository userCartRepository,
                             StoreRepository storeRepository) {
        this.groupOrderRepository = groupOrderRepository;
        this.userCartRepository = userCartRepository;
        this.storeRepository = storeRepository;
    }

    /**
     * 計算外送費公式：
     * - d <= 2.0 km: 20 元
     * - d <= 3.0 km: 30 元
     * - d > 3.0 km: 30 + Math.ceil(d - 3) * 5 元
     */
    public double calculateDeliveryFee(double distance) {
        if (distance <= 2.0) {
            return 20.0;
        } else if (distance <= 3.0) {
            return 30.0;
        } else {
            return 30.0 + Math.ceil(distance - 3.0) * 5.0;
        }
    }

    /**
     * 建立新的揪團房間
     */
    @Transactional
    public GroupOrder startGroup(String groupId, String storeId, String initiatorId, String initiatorName) {
        if (initiatorName == null || initiatorName.trim().isEmpty()) {
            throw new IllegalArgumentException("主揪暱稱不得為空！");
        }
        if (initiatorName.trim().length() > 20) {
            throw new IllegalArgumentException("主揪暱稱長度上限為 20 個字！");
        }

        // 冪等保護：若 groupId 已存在，直接返回現有房間
        Optional<GroupOrder> existing = groupOrderRepository.findById(groupId);
        if (existing.isPresent()) {
            return existing.get();
        }

        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new IllegalArgumentException("找不到指定的店家！"));
        double deliveryFee = calculateDeliveryFee(store.getDistance());
        
        GroupOrder group = new GroupOrder(groupId, storeId, initiatorId, "active", System.currentTimeMillis(), deliveryFee);
        
        // 同時初始化主揪的空購物車
        UserCart initiatorCart = new UserCart(groupId, initiatorId, initiatorName.trim(), "pending");
        userCartRepository.save(initiatorCart);
        
        return groupOrderRepository.save(group);
    }

    /**
     * 變更揪團進度狀態 (active -> locked -> processing -> delivering -> completed)
     */
    @Transactional
    public GroupOrder changeStatus(String groupId, String newStatus) {
        GroupOrder group = groupOrderRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));

        String currentStatus = group.getStatus();
        if (currentStatus.equals(newStatus)) {
            return group;
        }

        List<String> validStatuses = List.of("private", "active", "locked", "processing", "delivering", "completed");
        if (!validStatuses.contains(newStatus)) {
            throw new IllegalArgumentException("不合法的揪團狀態！");
        }

        switch (currentStatus) {
            case "private":
                if (!"active".equals(newStatus) && !"processing".equals(newStatus)) {
                    throw new IllegalStateException("私有房間只能變更為開團中 (active) 或製作中 (processing)！");
                }
                break;
            case "active":
                if (!"locked".equals(newStatus) && !"processing".equals(newStatus)) {
                    throw new IllegalStateException("開團中房間只能變更為已截止 (locked) 或製作中 (processing)！");
                }
                break;
            case "locked":
                if (!"active".equals(newStatus) && !"processing".equals(newStatus)) {
                    throw new IllegalStateException("已截止房間只能重新開放 (active) 或變更為製作中 (processing)！");
                }
                break;
            case "processing":
                if (!"delivering".equals(newStatus) && !"completed".equals(newStatus)) {
                    throw new IllegalStateException("製作中訂單只能變更為配送中 (delivering) 或已完成 (completed)！");
                }
                break;
            case "delivering":
                if (!"completed".equals(newStatus)) {
                    throw new IllegalStateException("配送中訂單只能變更為已完成 (completed)！");
                }
                break;
            case "completed":
                throw new IllegalStateException("該揪團已圓滿結束，無法再更改狀態！");
            default:
                throw new IllegalStateException("未知的目前房間狀態：" + currentStatus);
        }

        // 當狀態要變更為送出 (processing) 時，防呆：防範空購物車送出訂單
        if ("processing".equals(newStatus)) {
            List<UserCart> carts = userCartRepository.findByGroupId(groupId);
            boolean hasItems = carts.stream()
                .anyMatch(cart -> cart.getItems() != null && !cart.getItems().isEmpty());
            if (!hasItems) {
                throw new IllegalStateException("購物車目前是空的，無法送出訂單！");
            }
        }

        group.setStatus(newStatus);
        group.setLastStatusUpdatedAt(System.currentTimeMillis());
        return groupOrderRepository.save(group);
    }
}

