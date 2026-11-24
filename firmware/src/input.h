#pragma once
// Spider 3D — Hardware Input Driver (Analog Joystick ADC1 + 4 Tactile Switches)

#include "types.h"

void inputInit(InputState& in);
void inputCalibrateCenter(InputState& in);
void inputUpdate(InputState& in, float dt);
