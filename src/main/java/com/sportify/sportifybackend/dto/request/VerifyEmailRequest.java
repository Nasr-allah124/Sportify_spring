package com.sportify.sportifybackend.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

public record VerifyEmailRequest(
        @NotNull @Positive Long userId,
        @NotNull @Pattern(regexp = "[0-9]{6}") String code
) {}