package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.dto.request.RegisterRequest;
import com.sportify.sportifybackend.dto.request.VerifyEmailRequest;
import com.sportify.sportifybackend.dto.response.RegisterResponse;
import com.sportify.sportifybackend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.sportify.sportifybackend.dto.request.ResendCodeRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import java.util.Map;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }
    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request
    ) {
        AuthService.VerificationResult result = authService.verifyEmail(request);

        if (result == AuthService.VerificationResult.VERIFIED) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.badRequest().body(Map.of("code", result.name()));
    }
    @PostMapping("/resend-code")
    public ResponseEntity<Void> resendCode(
            @Valid @RequestBody ResendCodeRequest request
    ) {
        Duration delay = authService.resendCode(request.userId());

        if (delay.isZero()) {
            return ResponseEntity.noContent().build();
        }

        long seconds = delay.toSeconds();
        if (delay.getNano() > 0) {
            seconds++;
        }

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(seconds))
                .build();
    }
}