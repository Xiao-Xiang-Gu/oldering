package com.example.drinkparty.repository;

import com.example.drinkparty.model.UserCart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserCartRepository extends JpaRepository<UserCart, Long> {
    // 找出某個揪團房裡所有的成員購物車
    List<UserCart> findByGroupId(String groupId);
    
    // 找出特定成員在特定揪團房裡的購物車
    Optional<UserCart> findByGroupIdAndUserId(String groupId, String userId);
}
