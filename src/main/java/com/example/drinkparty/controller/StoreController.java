package com.example.drinkparty.controller;

import com.example.drinkparty.model.Store;
import com.example.drinkparty.repository.StoreRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stores")
@CrossOrigin // 允許跨網域存取
public class StoreController {

    private final StoreRepository storeRepository;

    public StoreController(StoreRepository storeRepository) {
        this.storeRepository = storeRepository;
    }

    /**
     * 獲取所有合作的飲料店家與詳細菜單
     */
    @GetMapping
    @Cacheable("stores")
    public List<Store> getAllStores() {
        System.out.println("🔍 [資料庫快取] 執行實時資料庫查詢 stores 與菜單資料！");
        return storeRepository.findAll();
    }
}
