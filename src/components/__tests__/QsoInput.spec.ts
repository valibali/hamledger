import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import QsoInput from "../qso/QsoInput.vue";
import { createPinia } from "pinia";

describe("QsoInput", () => {
  it("renders properly", () => {
    const wrapper = mount(QsoInput, {
      global: {
        plugins: [createPinia()],
      },
    });
    expect(wrapper.find(".qso_input_area").exists()).toBe(true);
    expect(wrapper.find(".section-title").text()).toBe("QSO Input");
  });

  it("has correct form fields", () => {
    const wrapper = mount(QsoInput, {
      global: {
        plugins: [createPinia()],
      },
    });

    // Check for required input fields
    expect(wrapper.find("#callsign").exists()).toBe(true);
    expect(wrapper.find("#band").exists()).toBe(true);
    expect(wrapper.find("#mode").exists()).toBe(true);
    expect(wrapper.find("#rstr").exists()).toBe(true);
    expect(wrapper.find("#rstt").exists()).toBe(true);
  });

  it("has correct band options", async () => {
    const wrapper = mount(QsoInput, {
      global: {
        plugins: [createPinia()],
      },
    });

    const options = wrapper.find("#band").findAll("option");
    const bandValues = ["10m", "20m", "40m"];

    expect(options.length).toBe(bandValues.length);
    options.forEach((option, index) => {
      expect(option.element.value).toBe(bandValues[index]);
    });
  });
});
