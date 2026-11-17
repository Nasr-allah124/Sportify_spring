package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.dto.request.RegisterRequest;
import com.sportify.sportifybackend.dto.request.VerifyEmailRequest;
import com.sportify.sportifybackend.dto.response.RegisterResponse;
import com.sportify.sportifybackend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        if (!authService.verifyEmail(request)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Code invalide, expiré ou nombre d’essais dépassé."
            );
        }
    }
}