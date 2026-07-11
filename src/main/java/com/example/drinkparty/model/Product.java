package com.example.drinkparty.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
public class Product {
    @Id
    private String id; // 例如: prod-101-1
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    @JsonIgnore
    private Store store;
    
    private String name;
    private String category;
    private double basePrice;
    private String description;
    private Integer inventory; // 庫存 (null 代表無限量)
    
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CustomOption> customOptions = new ArrayList<>();

    // Constructors
    public Product() {}

    public Product(String id, Store store, String name, String category, double basePrice, String description) {
        this.id = id;
        this.store = store;
        this.name = name;
        this.category = category;
        this.basePrice = basePrice;
        this.description = description;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public double getBasePrice() { return basePrice; }
    public void setBasePrice(double basePrice) { this.basePrice = basePrice; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getInventory() { return inventory; }
    public void setInventory(Integer inventory) { this.inventory = inventory; }

    public List<CustomOption> getCustomOptions() { return customOptions; }
    public void setCustomOptions(List<CustomOption> customOptions) { this.customOptions = customOptions; }
}
