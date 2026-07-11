package com.example.drinkparty.exception;

/**
 * 自定義例外：當越權存取他人揪團訂單時拋出
 */
public class SecurityAccessDeniedException extends RuntimeException {
    public SecurityAccessDeniedException(String message) {
        super(message);
    }
}
