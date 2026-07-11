package com.example.drinkparty.repository;

import com.example.drinkparty.model.CustomOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomOptionRepository extends JpaRepository<CustomOption, Long> {
    // 透過商品 ID 與客製化選項名稱查尋其價格，用以做後端算價防竄改
    Optional<CustomOption> findByProduct_IdAndName(String productId, String name);
}
