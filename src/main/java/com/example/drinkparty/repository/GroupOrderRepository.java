package com.example.drinkparty.repository;

import com.example.drinkparty.model.GroupOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface GroupOrderRepository extends JpaRepository<GroupOrder, String> {
    List<GroupOrder> findByStatus(String status);
}
