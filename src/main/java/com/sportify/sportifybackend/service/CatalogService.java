package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.dto.response.FieldResponse;
import com.sportify.sportifybackend.dto.response.SportComplexResponse;
import com.sportify.sportifybackend.entity.Field;
import com.sportify.sportifybackend.entity.SportComplex;
import com.sportify.sportifybackend.repository.FieldRepository;
import com.sportify.sportifybackend.repository.SportComplexRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

import java.text.Normalizer;
import java.util.Locale;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final SportComplexRepository complexes;
    private final FieldRepository fields;

    public CatalogService(SportComplexRepository complexes, FieldRepository fields) {
        this.complexes = complexes;
        this.fields = fields;
    }

    public List<SportComplexResponse> listComplexes() {
        return complexes.findByStatusOrderByIdAsc(SportComplex.Status.ACTIVE)
                .stream().map(SportComplexResponse::from).toList();
    }

   public List<FieldResponse> listFields(String city, Field.SportType sport) {
    var sports = sport == null
            ? EnumSet.allOf(Field.SportType.class)
            : EnumSet.of(sport);

    String searchedCity = normalizeCity(city);

    return fields.findVisibleFields(
                    SportComplex.Status.ACTIVE,
                    "",
                    sports
            )
            .stream()
            .filter(field ->
                    searchedCity.isEmpty()
                            || normalizeCity(field.getComplex().getCity())
                                    .startsWith(searchedCity)
            )
            .map(FieldResponse::from)
            .toList();
}
private String normalizeCity(String city) {
    if (city == null) {
        return "";
    }

    String normalized = Normalizer.normalize(
            city.strip(),
            Normalizer.Form.NFD
    );

    return normalized
            .replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT);
}

    public Optional<FieldResponse> findField(Long id) {
        return fields.findByIdAndActiveTrueAndComplex_Status(id, SportComplex.Status.ACTIVE)
                .map(FieldResponse::from);
    }
    private static final Pattern ACCENTS = Pattern.compile("\\p{M}+");
    private static final Pattern SEPARATORS = Pattern.compile("[^\\p{L}\\p{N}]+");

    public List<FieldResponse> searchFields(String query) {
        String normalizedQuery = normalizeSearchText(query);

        List<Field> visibleFields = fields.findVisibleFields(
                SportComplex.Status.ACTIVE,
                "",
                EnumSet.allOf(Field.SportType.class)
        );

        if (normalizedQuery.isEmpty()) {
            return visibleFields.stream()
                    .map(FieldResponse::from)
                    .toList();
        }

        List<String> words = Arrays.stream(normalizedQuery.split(" "))
                .distinct()
                .toList();

        return visibleFields.stream()
                .filter(field -> {
                    String text = searchableText(field);
                    return words.stream().allMatch(text::contains);
                })
                .map(FieldResponse::from)
                .toList();
    }

    private static String searchableText(Field field) {
        SportComplex complex = field.getComplex();

        String price = field.getHourlyPrice() == null
                ? null
                : field.getHourlyPrice().stripTrailingZeros().toPlainString()
                + " MAD DH dirhams";

        String capacity = field.getCapacity() == null
                ? null
                : field.getCapacity() + " joueurs personnes places";

        String text = Stream.of(
                        field.getName(),
                        field.getSportType().name(),
                        field.getDescription(),
                        complex.getName(),
                        complex.getCity(),
                        complex.getAddress(),
                        complex.getDescription(),
                        price,
                        capacity
                )
                .filter(Objects::nonNull)
                .collect(Collectors.joining(" "));

        return normalizeSearchText(text);
    }

    private static String normalizeSearchText(String value) {
        if (value == null || value.isBlank()) return "";

        String text = Normalizer.normalize(value, Normalizer.Form.NFD);
        text = ACCENTS.matcher(text).replaceAll("");
        text = text.toLowerCase(Locale.ROOT);

        return SEPARATORS.matcher(text).replaceAll(" ").strip();
    }
}