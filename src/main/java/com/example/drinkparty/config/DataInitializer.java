package com.example.drinkparty.config;

import com.example.drinkparty.model.CustomOption;
import com.example.drinkparty.model.Product;
import com.example.drinkparty.model.Store;
import com.example.drinkparty.repository.CustomOptionRepository;
import com.example.drinkparty.repository.ProductRepository;
import com.example.drinkparty.repository.StoreRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataInitializer implements CommandLineRunner {

    private final StoreRepository storeRepository;
    private final ProductRepository productRepository;
    private final CustomOptionRepository customOptionRepository;

    public DataInitializer(StoreRepository storeRepository, ProductRepository productRepository, CustomOptionRepository customOptionRepository) {
        this.storeRepository = storeRepository;
        this.productRepository = productRepository;
        this.customOptionRepository = customOptionRepository;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        if (storeRepository.count() > 0) {
            return; // 已經有資料，不需要初始化
        }

        System.out.println("🌱 初始化飲料店家與菜單預設資料...");

        // 1. 店家 A：星夜茶會 (Starry Tea)
        Store store1 = new Store(
            "store-101",
            "星夜茶會 (Starry Tea)",
            "02-2777-8888",
            200.0,
            4.8,
            "手搖茶飲",
            "https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&q=80&w=400",
            1.5
        );
        storeRepository.save(store1);

        // 商品 1-1：波霸經典奶茶
        Product p1 = new Product(
            "prod-101-1",
            store1,
            "波霸經典奶茶",
            "經典奶茶",
            55.0,
            "香濃醇厚的經典奶茶，搭配每日現煮 Q 彈黑糖波霸，口感極佳。"
        );
        productRepository.save(p1);
        
        saveOption(p1, "SIZE", "中杯 (M)", 0.0);
        saveOption(p1, "SIZE", "大杯 (L)", 10.0);
        saveOption(p1, "ICE", "正常冰", 0.0);
        saveOption(p1, "ICE", "少冰", 0.0);
        saveOption(p1, "ICE", "微冰", 0.0);
        saveOption(p1, "ICE", "去冰", 0.0);
        saveOption(p1, "ICE", "溫熱", 0.0);
        saveOption(p1, "SWEETNESS", "正常甜 (10分)", 0.0);
        saveOption(p1, "SWEETNESS", "少糖 (7分)", 0.0);
        saveOption(p1, "SWEETNESS", "半糖 (5分)", 0.0);
        saveOption(p1, "SWEETNESS", "微糖 (3分)", 0.0);
        saveOption(p1, "SWEETNESS", "無糖 (0分)", 0.0);
        saveOption(p1, "TOPPING", "波霸", 10.0);
        saveOption(p1, "TOPPING", "椰果", 10.0);
        saveOption(p1, "TOPPING", "小芋圓", 15.0);
        saveOption(p1, "TOPPING", "統一布丁", 20.0);
        saveOption(p1, "TOPPING", "仙草凍", 10.0);

        // 商品 1-2：四季春青茶
        Product p2 = new Product(
            "prod-101-2",
            store1,
            "四季春青茶",
            "清新原茶",
            35.0,
            "茶湯翠綠，入口生津，帶有獨特的清甜花香，回甘生津。"
        );
        productRepository.save(p2);
        
        saveOption(p2, "SIZE", "中杯 (M)", 0.0);
        saveOption(p2, "SIZE", "大杯 (L)", 5.0);
        saveOption(p2, "ICE", "正常冰", 0.0);
        saveOption(p2, "ICE", "少冰", 0.0);
        saveOption(p2, "ICE", "微冰", 0.0);
        saveOption(p2, "ICE", "去冰", 0.0);
        saveOption(p2, "SWEETNESS", "正常甜", 0.0);
        saveOption(p2, "SWEETNESS", "少糖", 0.0);
        saveOption(p2, "SWEETNESS", "半糖", 0.0);
        saveOption(p2, "SWEETNESS", "微糖", 0.0);
        saveOption(p2, "SWEETNESS", "無糖", 0.0);
        saveOption(p2, "TOPPING", "椰果", 10.0);
        saveOption(p2, "TOPPING", "蘆薈", 15.0);

        // 商品 1-3：小農鮮奶綠
        Product p3 = new Product(
            "prod-101-3",
            store1,
            "小農鮮奶綠",
            "小農鮮奶茶",
            65.0,
            "精選優質茉莉綠茶茶湯，融合在地優質小農鮮乳，口感細緻滑順。"
        );
        productRepository.save(p3);
        
        saveOption(p3, "SIZE", "中杯 (M)", 0.0);
        saveOption(p3, "SIZE", "大杯 (L)", 10.0);
        saveOption(p3, "ICE", "正常冰", 0.0);
        saveOption(p3, "ICE", "少冰", 0.0);
        saveOption(p3, "ICE", "微冰", 0.0);
        saveOption(p3, "ICE", "去冰", 0.0);
        saveOption(p3, "ICE", "溫熱", 0.0);
        saveOption(p3, "SWEETNESS", "正常甜", 0.0);
        saveOption(p3, "SWEETNESS", "少糖", 0.0);
        saveOption(p3, "SWEETNESS", "半糖", 0.0);
        saveOption(p3, "SWEETNESS", "微糖", 0.0);
        saveOption(p3, "SWEETNESS", "無糖", 0.0);
        saveOption(p3, "TOPPING", "波霸", 10.0);
        saveOption(p3, "TOPPING", "小芋圓", 15.0);
        saveOption(p3, "TOPPING", "布丁", 20.0);

        // 商品 1-4：楊枝甘露露
        Product p4 = new Product(
            "prod-101-4",
            store1,
            "楊枝甘露露",
            "鮮果樂園",
            85.0,
            "楊枝甘露搭配大量芒果與椰奶、西米露，夏日消暑首選！"
        );
        p4.setInventory(5);
        productRepository.save(p4);
        
        saveOption(p4, "SIZE", "大杯 (L) 固定規格", 0.0);
        saveOption(p4, "ICE", "冰沙固定", 0.0);
        saveOption(p4, "ICE", "微冰", 0.0);
        saveOption(p4, "SWEETNESS", "正常甜", 0.0);
        saveOption(p4, "SWEETNESS", "半糖", 0.0);
        saveOption(p4, "SWEETNESS", "微糖", 0.0);
        saveOption(p4, "TOPPING", "多加波霸", 10.0);
        saveOption(p4, "TOPPING", "多加椰果", 10.0);


        // 2. 店家 B：極光咖啡 (Aurora Coffee)
        Store store2 = new Store(
            "store-102",
            "極光咖啡 (Aurora Coffee)",
            "02-2999-5555",
            200.0,
            4.9,
            "精品咖啡",
            "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=400",
            3.5
        );
        storeRepository.save(store2);

        // 商品 2-1：極光拿鐵咖啡
        Product p5 = new Product(
            "prod-102-1",
            store2,
            "極光拿鐵咖啡",
            "經典義式",
            85.0,
            "精選中深烘焙義式配方豆，融合綿密鮮乳泡沫，層次豐富。"
        );
        productRepository.save(p5);
        
        saveOption(p5, "SIZE", "中杯 (M)", 0.0);
        saveOption(p5, "SIZE", "大杯 (L)", 15.0);
        saveOption(p5, "ICE", "熱飲", 0.0);
        saveOption(p5, "ICE", "去冰", 0.0);
        saveOption(p5, "ICE", "微冰", 0.0);
        saveOption(p5, "ICE", "正常冰", 0.0);
        saveOption(p5, "SWEETNESS", "無糖 (推薦)", 0.0);
        saveOption(p5, "SWEETNESS", "微糖", 0.0);
        saveOption(p5, "SWEETNESS", "半糖", 0.0);
        saveOption(p5, "TOPPING", "換燕麥奶", 20.0);
        saveOption(p5, "TOPPING", "加一份濃縮 (Espresso Shot)", 15.0);
        saveOption(p5, "TOPPING", "加焦糖淋醬", 10.0);

        // 商品 2-2：黑糖燕麥奶瑪奇朵
        Product p6 = new Product(
            "prod-102-2",
            store2,
            "黑糖燕麥奶瑪奇朵",
            "創意特調",
            95.0,
            "燕麥奶的穀物香氣融入醇厚黑糖與精品咖啡濃縮，乳糖不耐症者的最愛。"
        );
        productRepository.save(p6);
        
        saveOption(p6, "SIZE", "中杯 (M)", 0.0);
        saveOption(p6, "SIZE", "大杯 (L)", 15.0);
        saveOption(p6, "ICE", "熱飲", 0.0);
        saveOption(p6, "ICE", "去冰", 0.0);
        saveOption(p6, "ICE", "微冰", 0.0);
        saveOption(p6, "SWEETNESS", "正常甜", 0.0);
        saveOption(p6, "SWEETNESS", "微糖", 0.0);
        saveOption(p6, "TOPPING", "加一份濃縮 (Espresso Shot)", 15.0);

        // 商品 2-3：耶加雪菲 (手沖冰/熱)
        Product p7 = new Product(
            "prod-102-3",
            store2,
            "耶加雪菲 (手沖冰/熱)",
            "手沖精品",
            120.0,
            "衣索比亞產區精品，帶有淡淡的茉莉花香與檸檬柑橘酸甜感。"
        );
        productRepository.save(p7);
        
        saveOption(p7, "SIZE", "常規 (杯)", 0.0);
        saveOption(p7, "ICE", "手沖熱飲", 0.0);
        saveOption(p7, "ICE", "手沖冰飲", 0.0);
        saveOption(p7, "SWEETNESS", "無糖固定", 0.0);

        System.out.println("✅ 預設店家與菜單初始化完成！");
    }

    private void saveOption(Product p, String type, String name, double extraPrice) {
        CustomOption opt = new CustomOption(p, type, name, extraPrice);
        customOptionRepository.save(opt);
    }
}
