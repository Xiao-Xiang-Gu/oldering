package com.example.drinkparty.controller;

import com.example.drinkparty.model.GroupOrder;
import com.example.drinkparty.model.UserCart;
import com.example.drinkparty.repository.GroupOrderRepository;
import com.example.drinkparty.repository.UserCartRepository;
import com.example.drinkparty.service.CartService;
import com.example.drinkparty.service.GroupOrderService;
import com.example.drinkparty.exception.SecurityAccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@CrossOrigin
public class GroupOrderController {

    private final GroupOrderService groupOrderService;
    private final CartService cartService;
    private final GroupOrderRepository groupOrderRepository;
    private final UserCartRepository userCartRepository;

    public GroupOrderController(GroupOrderService groupOrderService,
                                CartService cartService,
                                GroupOrderRepository groupOrderRepository,
                                UserCartRepository userCartRepository) {
        this.groupOrderService = groupOrderService;
        this.cartService = cartService;
        this.groupOrderRepository = groupOrderRepository;
        this.userCartRepository = userCartRepository;
    }

    /**
     * 自定義例外處理：當越權存取時回傳 403 Forbidden
     */
    @ExceptionHandler(SecurityAccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleSecurityException(SecurityAccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", e.getMessage()));
    }

    /**
     * 發起揪團房間
     */
    @PostMapping("/start")
    public ResponseEntity<?> startGroup(@RequestBody Map<String, String> payload) {
        try {
            String groupId = payload.get("groupId");
            String storeId = payload.get("storeId");
            String initiatorId = payload.get("initiatorId");
            String initiatorName = payload.get("initiatorName");
            
            GroupOrder group = groupOrderService.startGroup(groupId, storeId, initiatorId, initiatorName);
            return ResponseEntity.ok(group);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 獲取單一房間詳細資訊 (此為公共資訊，用來確認房號是否有效與店家是誰)
     */
    @GetMapping("/{groupId}")
    public ResponseEntity<?> getGroupInfo(@PathVariable String groupId) {
        return groupOrderRepository.findById(groupId)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 跟團者加入房間 (正式在資料庫註冊 userId)
     */
    @PostMapping("/{groupId}/join")
    public ResponseEntity<?> joinGroup(@PathVariable String groupId, @RequestBody Map<String, String> payload) {
        try {
            String userId = payload.get("userId");
            String userName = payload.get("userName");
            UserCart cart = cartService.joinGroup(groupId, userId, userName);
            return ResponseEntity.ok(cart);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 獲取房間內所有人的購物車 (大總覽與成員清單)
     * 防禦性編程：必須先加入房間，否則回傳 403 拒絕存取他人訂單明細
     */
    @GetMapping("/{groupId}/carts")
    public ResponseEntity<?> getGroupCarts(@PathVariable String groupId,
                                           @RequestHeader(value = "X-User-Id", required = false) String requestUserId) {
        if (requestUserId == null || requestUserId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "未提供用戶識別碼，無權存取！"));
        }
        
        // 驗證當前用戶是否有權限存取該房
        cartService.validateAccess(groupId, requestUserId);
        
        List<UserCart> carts = userCartRepository.findByGroupId(groupId);
        return ResponseEntity.ok(carts);
    }

    /**
     * 截止或變更揪團房間狀態
     * 防禦性編程：只有主揪本人可以變更狀態！
     */
    @PostMapping("/{groupId}/status")
    public ResponseEntity<?> changeStatus(@PathVariable String groupId,
                                          @RequestHeader(value = "X-User-Id", required = false) String requestUserId,
                                          @RequestBody Map<String, String> payload) {
        try {
            if (requestUserId == null || requestUserId.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "未提供用戶識別碼，無權變更狀態！"));
            }

            GroupOrder group = groupOrderRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("找不到該揪團房間！"));

            // 防禦: 必須是主揪本人
            if (!group.getInitiatorId().equals(requestUserId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "越權存取：只有主揪本人才能截止揪團或送出訂單！"));
            }

            String newStatus = payload.get("newStatus");
            GroupOrder updatedGroup = groupOrderService.changeStatus(groupId, newStatus);
            return ResponseEntity.ok(updatedGroup);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
