package com.example.drinkparty.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "custom_options")
public class CustomOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    @JsonIgnore
    private Product product;
    
    private String type; // SIZE, ICE, SWEETNESS, TOPPING
    private String name; // 例如: 大杯 (L), 微冰, 半糖 (5分), 珍珠
    private double extraPrice;

    // Constructors
    public CustomOption() {}

    public CustomOption(Product product, String type, String name, double extraPrice) {
        this.product = product;
        this.type = type;
        this.name = name;
        this.extraPrice = extraPrice;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getExtraPrice() { return extraPrice; }
    public void setExtraPrice(double extraPrice) { this.extraPrice = extraPrice; }
}
