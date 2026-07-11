package com.example.drinkparty.service;

import com.example.drinkparty.model.GroupOrder;
import com.example.drinkparty.repository.GroupOrderRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class OrderStatusScheduler {

    private final GroupOrderRepository groupOrderRepository;
    private final GroupOrderService groupOrderService;

    public OrderStatusScheduler(GroupOrderRepository groupOrderRepository, GroupOrderService groupOrderService) {
        this.groupOrderRepository = groupOrderRepository;
        this.groupOrderService = groupOrderService;
    }

    /**
     * 每 3 秒檢查一次，自動將逾時的 processing 狀態變更為 delivering，
     * 並將 delivering 狀態變更為 completed。
     */
    @Scheduled(fixedRate = 3000)
    @Transactional
    public void autoUpdateOrderStatus() {
        long now = System.currentTimeMillis();
        // 展示超時時間設為 15 秒 (15000 毫秒)
        long threshold = 15000;

        // 1. 處理 processing -> delivering
        List<GroupOrder> processingOrders = groupOrderRepository.findByStatus("processing");
        for (GroupOrder order : processingOrders) {
            long lastUpdated = order.getLastStatusUpdatedAt() != null ? order.getLastStatusUpdatedAt() : order.getCreatedAt();
            if (now - lastUpdated >= threshold) {
                try {
                    groupOrderService.changeStatus(order.getId(), "delivering");
                    System.out.println("⏰ [自動排程] 房間 " + order.getId() + " 已自動流轉至 [delivering] 外送中");
                } catch (Exception e) {
                    System.err.println("❌ [自動排程] 房間 " + order.getId() + " 變更狀態失敗: " + e.getMessage());
                }
            }
        }

        // 2. 處理 delivering -> completed
        List<GroupOrder> deliveringOrders = groupOrderRepository.findByStatus("delivering");
        for (GroupOrder order : deliveringOrders) {
            long lastUpdated = order.getLastStatusUpdatedAt() != null ? order.getLastStatusUpdatedAt() : order.getCreatedAt();
            if (now - lastUpdated >= threshold) {
                try {
                    groupOrderService.changeStatus(order.getId(), "completed");
                    System.out.println("⏰ [自動排程] 房間 " + order.getId() + " 已自動流轉至 [completed] 已完成");
                } catch (Exception e) {
                    System.err.println("❌ [自動排程] 房間 " + order.getId() + " 變更狀態失敗: " + e.getMessage());
                }
            }
        }
    }
}
