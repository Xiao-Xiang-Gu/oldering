package com.example.drinkparty.model;

import jakarta.persistence.*;

@Entity
@Table(name = "group_orders")
public class GroupOrder {
    @Id
    private String id; // 例如: G-1780986113574
    
    private String storeId;
    private String initiatorId;
    private String status; // active, locked, processing, delivering, completed
    private long createdAt;
    private Double deliveryFee; // 外送費
    private Long lastStatusUpdatedAt; // 上次狀態更新時間戳

    // Constructors
    public GroupOrder() {}

    public GroupOrder(String id, String storeId, String initiatorId, String status, long createdAt, Double deliveryFee) {
        this.id = id;
        this.storeId = storeId;
        this.initiatorId = initiatorId;
        this.status = status;
        this.createdAt = createdAt;
        this.deliveryFee = deliveryFee;
        this.lastStatusUpdatedAt = createdAt;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStoreId() { return storeId; }
    public void setStoreId(String storeId) { this.storeId = storeId; }

    public String getInitiatorId() { return initiatorId; }
    public void setInitiatorId(String initiatorId) { this.initiatorId = initiatorId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public Double getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(Double deliveryFee) { this.deliveryFee = deliveryFee; }

    public Long getLastStatusUpdatedAt() { return lastStatusUpdatedAt; }
    public void setLastStatusUpdatedAt(Long lastStatusUpdatedAt) { this.lastStatusUpdatedAt = lastStatusUpdatedAt; }
}
