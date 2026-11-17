package com.sportify.sportifybackend.dto.response;

public record RegisterResponse(
        Long userId,
        boolean emailVerificationRequired
) {}