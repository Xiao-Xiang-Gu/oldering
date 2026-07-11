package com.example.drinkparty.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "stores")
public class Store {
    @Id
    private String id; // 例如: store-101
    
    private String name;
    private String phone;
    private double minDeliveryCharge;
    private double rating;
    private String category;
    private String image;
    private Double distance; // 距離 (公里)
    
    @OneToMany(mappedBy = "store", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Product> menu = new ArrayList<>();

    // Constructors
    public Store() {}

    public Store(String id, String name, String phone, double minDeliveryCharge, double rating, String category, String image, Double distance) {
        this.id = id;
        this.name = name;
        this.phone = phone;
        this.minDeliveryCharge = minDeliveryCharge;
        this.rating = rating;
        this.category = category;
        this.image = image;
        this.distance = distance;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public double getMinDeliveryCharge() { return minDeliveryCharge; }
    public void setMinDeliveryCharge(double minDeliveryCharge) { this.minDeliveryCharge = minDeliveryCharge; }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public Double getDistance() { return distance; }
    public void setDistance(Double distance) { this.distance = distance; }

    public List<Product> getMenu() { return menu; }
    public void setMenu(List<Product> menu) { this.menu = menu; }
}
