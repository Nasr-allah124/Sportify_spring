package com.sportify.sportifybackend.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ResendCodeRequest(
        @NotNull @Positive Long userId
) {}