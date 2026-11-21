package com.sportify.sportifybackend.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 100)
        @Pattern(regexp = "(?sU).*\\S.*", message = "Le prénom doit contenir du texte.")
        String firstName,

        @Size(max = 100)
        @Pattern(regexp = "(?sU).*\\S.*", message = "Le nom doit contenir du texte.")
        String lastName,

        @Size(max = 30)
        String phone
) {}