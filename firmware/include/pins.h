#pragma once
// Spider 3D — LILYGO T-Display-S3 Hardware Pinmap & Input Tuning
// Safe GPIOs avoiding ST7789 8-bit parallel LCD (5~9, 15, 38~42, 45~48) & UART (43, 44).

#include <stdint.h>

// ---- Display Power & Geometry ----
constexpr int PIN_LCD_POWER_ON = 15;   // Must be HIGH for battery operation
constexpr int PIN_LCD_BL       = 38;   // Backlight PWM / HIGH
constexpr int LCD_W            = 320;
constexpr int LCD_H            = 170;

// ---- Analog Joystick (ADC1: 0..4095, powered by 3.3V & GND) ----
constexpr int   PIN_JOY_X      = 1;    // ADC1_CH0 (Left / Right)
constexpr int   PIN_JOY_Y      = 2;    // ADC1_CH1 (Forward / Back)
constexpr bool  JOY_ENABLE_ADC = true; // Set false if no analog joystick is wired yet
constexpr bool  JOY_INVERT_X   = false;
constexpr bool  JOY_INVERT_Y   = true; // Most KY-023 modules output lower ADC when pushed UP/FORWARD
constexpr float JOY_DEADZONE   = 0.14f;

// ---- Tactile Buttons (Active-LOW with internal INPUT_PULLUP -> connect switch to GND) ----
// Both built-in board buttons AND external tactile switches work simultaneously (OR logic).
constexpr int PIN_BTN_SWING_INT  = 14; // T-Display-S3 built-in right button
constexpr int PIN_BTN_SWING_EXT  = 3;  // External SWING tactile switch -> GND
constexpr int PIN_BTN_STRIKE_INT = 0;  // T-Display-S3 built-in boot button (do not hold during reset)
constexpr int PIN_BTN_STRIKE_EXT = 10; // External STRIKE tactile switch -> GND

// ---- Passive Piezo Buzzer (LEDC PWM -> Buzzer+ / Buzzer- to GND) ----
constexpr int PIN_BUZZER         = 11;
constexpr int BUZZER_LEDC_CH     = 2;  // Avoid channel 0 if backlight PWM uses it
