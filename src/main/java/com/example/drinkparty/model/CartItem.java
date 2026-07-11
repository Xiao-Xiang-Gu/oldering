package com.example.drinkparty.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cart_items")
public class CartItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_cart_id")
    @JsonIgnore
    private UserCart userCart;
    
    private String productId;
    private String productName;
    private String size;
    private String ice;
    private String sweetness;
    private double price; // 後端計算出的價格，防篡改！
    private int quantity; // 數量，必須大於 0
    
    @OneToMany(mappedBy = "cartItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CartTopping> toppings = new ArrayList<>();

    // Constructors
    public CartItem() {}

    public CartItem(UserCart userCart, String productId, String productName, String size, String ice, String sweetness, double price, int quantity) {
        this.userCart = userCart;
        this.productId = productId;
        this.productName = productName;
        this.size = size;
        this.ice = ice;
        this.sweetness = sweetness;
        this.price = price;
        this.quantity = quantity;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public UserCart getUserCart() { return userCart; }
    public void setUserCart(UserCart userCart) { this.userCart = userCart; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getSize() { return size; }
    public void setSize(String size) { this.size = size; }

    public String getIce() { return ice; }
    public void setIce(String ice) { this.ice = ice; }

    public String getSweetness() { return sweetness; }
    public void setSweetness(String sweetness) { this.sweetness = sweetness; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public List<CartTopping> getToppings() { return toppings; }
    public void setToppings(List<CartTopping> toppings) { this.toppings = toppings; }
}
