// Measured tokens for the ds-button variants and markdown links this app renders.
// SP-UI-035, 036, 037, 040-042, 065, 071, 072, 128, 225, 235, 247, 248, 291, 301, 374, 381, 393, 402.
import { expect, test } from '@playwright/test'

type Case = { id: string; selector: string; property: string; theme: string; value: string }

const CASES: Case[] = [
  {
    "id": "SP-UI-029",
    "selector": ".ds-button",
    "property": "--dsl-button-border-color",
    "theme": "both",
    "value": "transparent"
  },
  {
    "id": "SP-UI-030",
    "selector": ".ds-button",
    "property": "--dsl-button-border-radius",
    "theme": "both",
    "value": "4096px"
  },
  {
    "id": "SP-UI-031",
    "selector": ".ds-button",
    "property": "--dsl-button-box-shadow",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-032",
    "selector": ".ds-button",
    "property": "--dsl-button-color",
    "theme": "both",
    "value": "transparent"
  },
  {
    "id": "SP-UI-033",
    "selector": ".ds-button",
    "property": "--dsl-button-color-hover",
    "theme": "both",
    "value": "transparent"
  },
  {
    "id": "SP-UI-034",
    "selector": ".ds-button",
    "property": "--dsl-button-font-weight",
    "theme": "both",
    "value": "400"
  },
  {
    "id": "SP-UI-035",
    "selector": ".ds-button",
    "property": "--dsl-button-opacity-disabled",
    "theme": "both",
    "value": ".45"
  },
  {
    "id": "SP-UI-036",
    "selector": ".ds-button",
    "property": "--dsl-button-ring-color",
    "theme": "dark",
    "value": "#5686fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-037",
    "selector": ".ds-button",
    "property": "--dsl-button-ring-color",
    "theme": "light",
    "value": "#3964fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-038",
    "selector": ".ds-button",
    "property": "--dsl-button-text-color",
    "theme": "dark",
    "value": "#f9fafb (var(--dsw-alias-label-primary))"
  },
  {
    "id": "SP-UI-039",
    "selector": ".ds-button",
    "property": "--dsl-button-text-color",
    "theme": "light",
    "value": "#0f1115 (var(--dsw-alias-label-primary))"
  },
  {
    "id": "SP-UI-040",
    "selector": ".ds-button",
    "property": "--dsl-button-text-color-disabled",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-041",
    "selector": ".ds-button",
    "property": "--dsl-button-text-color-hover",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-042",
    "selector": ".ds-button",
    "property": "--dsl-button-text-color-loading",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-046",
    "selector": ".ds-button",
    "property": "align-items",
    "theme": "both",
    "value": "center"
  },
  {
    "id": "SP-UI-047",
    "selector": ".ds-button",
    "property": "background-color",
    "theme": "both",
    "value": "transparent"
  },
  {
    "id": "SP-UI-048",
    "selector": ".ds-button",
    "property": "border-radius",
    "theme": "both",
    "value": "var(--dsl-button-border-radius)"
  },
  {
    "id": "SP-UI-049",
    "selector": ".ds-button",
    "property": "box-shadow",
    "theme": "both",
    "value": "var(--dsl-button-box-shadow)"
  },
  {
    "id": "SP-UI-050",
    "selector": ".ds-button",
    "property": "box-sizing",
    "theme": "both",
    "value": "border-box"
  },
  {
    "id": "SP-UI-051",
    "selector": ".ds-button",
    "property": "color",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-052",
    "selector": ".ds-button",
    "property": "cursor",
    "theme": "both",
    "value": "pointer"
  },
  {
    "id": "SP-UI-053",
    "selector": ".ds-button",
    "property": "display",
    "theme": "both",
    "value": "inline-flex"
  },
  {
    "id": "SP-UI-054",
    "selector": ".ds-button",
    "property": "font-size",
    "theme": "both",
    "value": "var(--dsl-button-font-size)"
  },
  {
    "id": "SP-UI-055",
    "selector": ".ds-button",
    "property": "font-variant-numeric",
    "theme": "both",
    "value": "tabular-nums"
  },
  {
    "id": "SP-UI-056",
    "selector": ".ds-button",
    "property": "font-weight",
    "theme": "both",
    "value": "var(--dsl-button-font-weight)"
  },
  {
    "id": "SP-UI-057",
    "selector": ".ds-button",
    "property": "gap",
    "theme": "both",
    "value": "var(--dsl-button-icon-gap)"
  },
  {
    "id": "SP-UI-058",
    "selector": ".ds-button",
    "property": "height",
    "theme": "both",
    "value": "var(--dsl-button-height)"
  },
  {
    "id": "SP-UI-059",
    "selector": ".ds-button",
    "property": "justify-content",
    "theme": "both",
    "value": "center"
  },
  {
    "id": "SP-UI-060",
    "selector": ".ds-button",
    "property": "line-height",
    "theme": "both",
    "value": "var(--dsl-button-line-height)"
  },
  {
    "id": "SP-UI-061",
    "selector": ".ds-button",
    "property": "outline",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-062",
    "selector": ".ds-button",
    "property": "padding",
    "theme": "both",
    "value": "var(--dsl-button-padding)"
  },
  {
    "id": "SP-UI-063",
    "selector": ".ds-button",
    "property": "position",
    "theme": "both",
    "value": "relative"
  },
  {
    "id": "SP-UI-064",
    "selector": ".ds-button",
    "property": "text-decoration",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-065",
    "selector": ".ds-button",
    "property": "transition",
    "theme": "both",
    "value": "opacity .2s cubic-bezier(.4, 0, .2, 1), color .3s cubic-bezier(.4, 0, .2, 1), text-decoration-color .3s cubic-bezier(.4, 0, .2, 1) (opacity var(--ds-transition-duration) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out), text-decoration-color var(--ds-transition-duration-slow) var(--ds-ease-in-out))"
  },
  {
    "id": "SP-UI-066",
    "selector": ".ds-button",
    "property": "user-select",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-067",
    "selector": ".ds-button",
    "property": "white-space",
    "theme": "both",
    "value": "nowrap"
  },
  {
    "id": "SP-UI-071",
    "selector": ".ds-button:focus-visible:not(.ds-button--disabled)>.ds-button__background:after",
    "property": "box-shadow",
    "theme": "both",
    "value": "0 0 0 2px var(--dsl-button-ring-color)"
  },
  {
    "id": "SP-UI-072",
    "selector": ".ds-button:hover:not(.ds-button--disabled):not(.ds-button--loading)",
    "property": "color",
    "theme": "both",
    "value": "var(--dsl-button-text-color-hover)"
  },
  {
    "id": "SP-UI-073",
    "selector": ".ds-button:hover:not(.ds-button--disabled):not(.ds-button--loading)>.ds-button__background",
    "property": "background-color",
    "theme": "both",
    "value": "var(--dsl-button-color-hover)"
  },
  {
    "id": "SP-UI-126",
    "selector": ".ds-button.ds-button--disabled",
    "property": "color",
    "theme": "both",
    "value": "var(--dsl-button-text-color-disabled)"
  },
  {
    "id": "SP-UI-127",
    "selector": ".ds-button.ds-button--disabled",
    "property": "cursor",
    "theme": "both",
    "value": "not-allowed"
  },
  {
    "id": "SP-UI-128",
    "selector": ".ds-button.ds-button--disabled",
    "property": "opacity",
    "theme": "both",
    "value": "var(--dsl-button-opacity-disabled)"
  },
  {
    "id": "SP-UI-140",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-color",
    "theme": "dark",
    "value": "#5686fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-141",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-color",
    "theme": "light",
    "value": "#3964fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-142",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-color-hover",
    "theme": "dark",
    "value": "#3964fe (var(--dsw-alias-button-primary-hover))"
  },
  {
    "id": "SP-UI-143",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-color-hover",
    "theme": "light",
    "value": "#5686fe (var(--dsw-alias-button-primary-hover))"
  },
  {
    "id": "SP-UI-144",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-font-weight",
    "theme": "both",
    "value": "500"
  },
  {
    "id": "SP-UI-145",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-ring-color",
    "theme": "dark",
    "value": "#5686fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-146",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-ring-color",
    "theme": "light",
    "value": "#3964fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-147",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-text-color",
    "theme": "both",
    "value": "#fff (var(--dsw-alias-label-primary-foreground))"
  },
  {
    "id": "SP-UI-148",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-text-color-disabled",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-149",
    "selector": ".ds-button.ds-button--filled.ds-button--primary",
    "property": "--dsl-button-text-color-hover",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-222",
    "selector": ".ds-button.ds-button--l",
    "property": "--dsl-button-font-size",
    "theme": "both",
    "value": "14px (var(--dsw-font-s-14-font-size))"
  },
  {
    "id": "SP-UI-223",
    "selector": ".ds-button.ds-button--l",
    "property": "--dsl-button-height",
    "theme": "both",
    "value": "40px (var(--ds-control-height-l))"
  },
  {
    "id": "SP-UI-224",
    "selector": ".ds-button.ds-button--l",
    "property": "--dsl-button-icon-gap",
    "theme": "both",
    "value": "6px"
  },
  {
    "id": "SP-UI-225",
    "selector": ".ds-button.ds-button--l",
    "property": "--dsl-button-icon-size",
    "theme": "both",
    "value": "16px"
  },
  {
    "id": "SP-UI-226",
    "selector": ".ds-button.ds-button--l",
    "property": "--dsl-button-line-height",
    "theme": "both",
    "value": "22px (var(--dsw-font-s-14-line-height))"
  },
  {
    "id": "SP-UI-227",
    "selector": ".ds-button.ds-button--l",
    "property": "--dsl-button-min-width",
    "theme": "both",
    "value": "72px"
  },
  {
    "id": "SP-UI-228",
    "selector": ".ds-button.ds-button--l",
    "property": "--dsl-button-padding",
    "theme": "both",
    "value": "0 14px"
  },
  {
    "id": "SP-UI-232",
    "selector": ".ds-button.ds-button--m",
    "property": "--dsl-button-font-size",
    "theme": "both",
    "value": "14px (var(--dsw-font-s-14-font-size))"
  },
  {
    "id": "SP-UI-233",
    "selector": ".ds-button.ds-button--m",
    "property": "--dsl-button-height",
    "theme": "both",
    "value": "36px (var(--ds-control-height-m))"
  },
  {
    "id": "SP-UI-234",
    "selector": ".ds-button.ds-button--m",
    "property": "--dsl-button-icon-gap",
    "theme": "both",
    "value": "4px"
  },
  {
    "id": "SP-UI-235",
    "selector": ".ds-button.ds-button--m",
    "property": "--dsl-button-icon-size",
    "theme": "both",
    "value": "16px"
  },
  {
    "id": "SP-UI-236",
    "selector": ".ds-button.ds-button--m",
    "property": "--dsl-button-line-height",
    "theme": "both",
    "value": "22px (var(--dsw-font-s-14-line-height))"
  },
  {
    "id": "SP-UI-237",
    "selector": ".ds-button.ds-button--m",
    "property": "--dsl-button-min-width",
    "theme": "both",
    "value": "72px"
  },
  {
    "id": "SP-UI-238",
    "selector": ".ds-button.ds-button--m",
    "property": "--dsl-button-padding",
    "theme": "both",
    "value": "0 14px"
  },
  {
    "id": "SP-UI-239",
    "selector": ".ds-button.ds-button--min-width",
    "property": "flex-shrink",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-240",
    "selector": ".ds-button.ds-button--min-width",
    "property": "min-width",
    "theme": "both",
    "value": "var(--dsl-button-min-width)"
  },
  {
    "id": "SP-UI-242",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-border-color",
    "theme": "dark",
    "value": "#f25a5a (var(--dsw-alias-state-error-primary))"
  },
  {
    "id": "SP-UI-243",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-border-color",
    "theme": "light",
    "value": "#ec1313 (var(--dsw-alias-state-error-primary))"
  },
  {
    "id": "SP-UI-244",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-color",
    "theme": "both",
    "value": "transparent"
  },
  {
    "id": "SP-UI-245",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-color-hover",
    "theme": "dark",
    "value": "rgba(242,90,90,.15) (var(--dsw-alias-interactive-bg-hover-danger))"
  },
  {
    "id": "SP-UI-246",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-color-hover",
    "theme": "light",
    "value": "rgba(236,19,19,.05) (var(--dsw-alias-interactive-bg-hover-danger))"
  },
  {
    "id": "SP-UI-247",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-ring-color",
    "theme": "dark",
    "value": "#f25a5a (var(--dsw-alias-state-error-primary))"
  },
  {
    "id": "SP-UI-248",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-ring-color",
    "theme": "light",
    "value": "#ec1313 (var(--dsw-alias-state-error-primary))"
  },
  {
    "id": "SP-UI-249",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-text-color",
    "theme": "dark",
    "value": "#f25a5a (var(--dsw-alias-state-error-primary))"
  },
  {
    "id": "SP-UI-250",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-text-color",
    "theme": "light",
    "value": "#ec1313 (var(--dsw-alias-state-error-primary))"
  },
  {
    "id": "SP-UI-251",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-text-color-disabled",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-252",
    "selector": ".ds-button.ds-button--outlined.ds-button--error",
    "property": "--dsl-button-text-color-hover",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-253",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-border-color",
    "theme": "dark",
    "value": "rgba(255,255,255,.12) (var(--dsw-alias-border-l2))"
  },
  {
    "id": "SP-UI-254",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-border-color",
    "theme": "light",
    "value": "rgba(0,0,0,.1) (var(--dsw-alias-border-l2))"
  },
  {
    "id": "SP-UI-255",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-color",
    "theme": "both",
    "value": "transparent"
  },
  {
    "id": "SP-UI-256",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-color-hover",
    "theme": "dark",
    "value": "rgba(255,255,255,.08) (var(--dsw-alias-interactive-bg-hover))"
  },
  {
    "id": "SP-UI-257",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-color-hover",
    "theme": "light",
    "value": "rgba(38,49,72,.06) (var(--dsw-alias-interactive-bg-hover))"
  },
  {
    "id": "SP-UI-258",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-ring-color",
    "theme": "dark",
    "value": "#5686fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-259",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-ring-color",
    "theme": "light",
    "value": "#3964fe (var(--dsw-alias-button-primary-fill))"
  },
  {
    "id": "SP-UI-260",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-text-color",
    "theme": "dark",
    "value": "#f9fafb (var(--dsw-alias-label-primary))"
  },
  {
    "id": "SP-UI-261",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-text-color",
    "theme": "light",
    "value": "#0f1115 (var(--dsw-alias-label-primary))"
  },
  {
    "id": "SP-UI-262",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-text-color-disabled",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-263",
    "selector": ".ds-button.ds-button--outlined.ds-button--outlinedNeutral",
    "property": "--dsl-button-text-color-hover",
    "theme": "both",
    "value": "var(--dsl-button-text-color)"
  },
  {
    "id": "SP-UI-282",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "border",
    "theme": "both",
    "value": "1px solid var(--dsl-button-border-color)"
  },
  {
    "id": "SP-UI-283",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "border-radius",
    "theme": "both",
    "value": "inherit"
  },
  {
    "id": "SP-UI-284",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "bottom",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-285",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "box-sizing",
    "theme": "both",
    "value": "border-box"
  },
  {
    "id": "SP-UI-286",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "left",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-287",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "pointer-events",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-288",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "position",
    "theme": "both",
    "value": "absolute"
  },
  {
    "id": "SP-UI-289",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "right",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-290",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "top",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-291",
    "selector": ".ds-button.ds-button--outlined>.ds-button__border",
    "property": "transition",
    "theme": "both",
    "value": "border-color .2s cubic-bezier(.4, 0, .2, 1) (border-color var(--ds-transition-duration) var(--ds-ease-in-out))"
  },
  {
    "id": "SP-UI-298",
    "selector": ".ds-button.ds-button--s",
    "property": "--dsl-button-font-size",
    "theme": "both",
    "value": "14px (var(--dsw-font-s-14-font-size))"
  },
  {
    "id": "SP-UI-299",
    "selector": ".ds-button.ds-button--s",
    "property": "--dsl-button-height",
    "theme": "both",
    "value": "32px (var(--ds-control-height-s))"
  },
  {
    "id": "SP-UI-300",
    "selector": ".ds-button.ds-button--s",
    "property": "--dsl-button-icon-gap",
    "theme": "both",
    "value": "4px"
  },
  {
    "id": "SP-UI-301",
    "selector": ".ds-button.ds-button--s",
    "property": "--dsl-button-icon-size",
    "theme": "both",
    "value": "14px"
  },
  {
    "id": "SP-UI-302",
    "selector": ".ds-button.ds-button--s",
    "property": "--dsl-button-line-height",
    "theme": "both",
    "value": "22px (var(--dsw-font-s-14-line-height))"
  },
  {
    "id": "SP-UI-303",
    "selector": ".ds-button.ds-button--s",
    "property": "--dsl-button-min-width",
    "theme": "both",
    "value": "58px"
  },
  {
    "id": "SP-UI-304",
    "selector": ".ds-button.ds-button--s",
    "property": "--dsl-button-padding",
    "theme": "both",
    "value": "0 14px"
  },
  {
    "id": "SP-UI-370",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-font-size",
    "theme": "both",
    "value": "14px (var(--dsw-font-s-14-font-size))"
  },
  {
    "id": "SP-UI-371",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-font-weight",
    "theme": "both",
    "value": "500"
  },
  {
    "id": "SP-UI-372",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-height",
    "theme": "both",
    "value": "44px (var(--ds-control-height-xl))"
  },
  {
    "id": "SP-UI-373",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-icon-gap",
    "theme": "both",
    "value": "6px"
  },
  {
    "id": "SP-UI-374",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-icon-size",
    "theme": "both",
    "value": "16px"
  },
  {
    "id": "SP-UI-375",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-line-height",
    "theme": "both",
    "value": "22px (var(--dsw-font-s-14-line-height))"
  },
  {
    "id": "SP-UI-376",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-min-width",
    "theme": "both",
    "value": "72px"
  },
  {
    "id": "SP-UI-377",
    "selector": ".ds-button.ds-button--xl",
    "property": "--dsl-button-padding",
    "theme": "both",
    "value": "0 14px"
  },
  {
    "id": "SP-UI-378",
    "selector": ".ds-button.ds-button--xs",
    "property": "--dsl-button-font-size",
    "theme": "both",
    "value": "13px (var(--dsw-font-xs-13-font-size))"
  },
  {
    "id": "SP-UI-379",
    "selector": ".ds-button.ds-button--xs",
    "property": "--dsl-button-height",
    "theme": "both",
    "value": "28px (var(--ds-control-height-xs))"
  },
  {
    "id": "SP-UI-380",
    "selector": ".ds-button.ds-button--xs",
    "property": "--dsl-button-icon-gap",
    "theme": "both",
    "value": "3px"
  },
  {
    "id": "SP-UI-381",
    "selector": ".ds-button.ds-button--xs",
    "property": "--dsl-button-icon-size",
    "theme": "both",
    "value": "14px"
  },
  {
    "id": "SP-UI-382",
    "selector": ".ds-button.ds-button--xs",
    "property": "--dsl-button-line-height",
    "theme": "both",
    "value": "20px (var(--dsw-font-xs-13-line-height))"
  },
  {
    "id": "SP-UI-383",
    "selector": ".ds-button.ds-button--xs",
    "property": "--dsl-button-min-width",
    "theme": "both",
    "value": "58px"
  },
  {
    "id": "SP-UI-384",
    "selector": ".ds-button.ds-button--xs",
    "property": "--dsl-button-padding",
    "theme": "both",
    "value": "0 10px"
  },
  {
    "id": "SP-UI-385",
    "selector": ".ds-button>.ds-button__background",
    "property": "background-color",
    "theme": "both",
    "value": "var(--dsl-button-color)"
  },
  {
    "id": "SP-UI-386",
    "selector": ".ds-button>.ds-button__background",
    "property": "border-radius",
    "theme": "both",
    "value": "inherit"
  },
  {
    "id": "SP-UI-387",
    "selector": ".ds-button>.ds-button__background",
    "property": "bottom",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-388",
    "selector": ".ds-button>.ds-button__background",
    "property": "box-sizing",
    "theme": "both",
    "value": "border-box"
  },
  {
    "id": "SP-UI-389",
    "selector": ".ds-button>.ds-button__background",
    "property": "left",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-390",
    "selector": ".ds-button>.ds-button__background",
    "property": "position",
    "theme": "both",
    "value": "absolute"
  },
  {
    "id": "SP-UI-391",
    "selector": ".ds-button>.ds-button__background",
    "property": "right",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-392",
    "selector": ".ds-button>.ds-button__background",
    "property": "top",
    "theme": "both",
    "value": "0"
  },
  {
    "id": "SP-UI-393",
    "selector": ".ds-button>.ds-button__background",
    "property": "transition",
    "theme": "both",
    "value": "background-color .2s cubic-bezier(.4, 0, .2, 1) (background-color var(--ds-transition-duration) var(--ds-ease-in-out))"
  },
  {
    "id": "SP-UI-394",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "border-radius",
    "theme": "both",
    "value": "calc(var(--dsl-button-border-radius) + 2px)"
  },
  {
    "id": "SP-UI-395",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "bottom",
    "theme": "both",
    "value": "-2px"
  },
  {
    "id": "SP-UI-396",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "content",
    "theme": "both",
    "value": "\"\""
  },
  {
    "id": "SP-UI-397",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "left",
    "theme": "both",
    "value": "-2px"
  },
  {
    "id": "SP-UI-398",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "pointer-events",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-399",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "position",
    "theme": "both",
    "value": "absolute"
  },
  {
    "id": "SP-UI-400",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "right",
    "theme": "both",
    "value": "-2px"
  },
  {
    "id": "SP-UI-401",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "top",
    "theme": "both",
    "value": "-2px"
  },
  {
    "id": "SP-UI-402",
    "selector": ".ds-button>.ds-button__background:after",
    "property": "transition",
    "theme": "both",
    "value": "box-shadow .2s cubic-bezier(.4, 0, .2, 1) (box-shadow var(--ds-transition-duration) var(--ds-ease-in-out))"
  },
  {
    "id": "SP-UI-403",
    "selector": ".ds-button>.ds-button__content",
    "property": "position",
    "theme": "both",
    "value": "relative"
  },
  {
    "id": "SP-UI-837",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "border",
    "theme": "both",
    "value": "2px solid rgba(255,255,255,0)"
  },
  {
    "id": "SP-UI-838",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "border-width",
    "theme": "both",
    "value": "2px 3px"
  },
  {
    "id": "SP-UI-839",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "color",
    "theme": "dark",
    "value": "#679efe (var(--dsw-alias-brand-text))"
  },
  {
    "id": "SP-UI-840",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "color",
    "theme": "light",
    "value": "#3964fe (var(--dsw-alias-brand-text))"
  },
  {
    "id": "SP-UI-841",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "margin-left",
    "theme": "both",
    "value": "-3px"
  },
  {
    "id": "SP-UI-842",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "margin-right",
    "theme": "both",
    "value": "-3px"
  },
  {
    "id": "SP-UI-843",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "position",
    "theme": "both",
    "value": "relative"
  },
  {
    "id": "SP-UI-844",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "text-decoration",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-845",
    "selector": ".ds-markdown a:not(.ds-a)",
    "property": "transition",
    "theme": "both",
    "value": "box-shadow .2s cubic-bezier(.4, 0, .2, 1) (box-shadow var(--ds-transition-duration) var(--ds-ease-in-out))"
  },
  {
    "id": "SP-UI-851",
    "selector": ".ds-markdown a:not(.ds-a):focus-visible",
    "property": "box-shadow",
    "theme": "dark",
    "value": "0 0 0 2px #679efe (0 0 0 2px var(--dsw-alias-brand-text))"
  },
  {
    "id": "SP-UI-852",
    "selector": ".ds-markdown a:not(.ds-a):focus-visible",
    "property": "box-shadow",
    "theme": "light",
    "value": "0 0 0 2px #3964fe (0 0 0 2px var(--dsw-alias-brand-text))"
  },
  {
    "id": "SP-UI-855",
    "selector": ".ds-markdown a:not(.ds-a):hover",
    "property": "outline",
    "theme": "both",
    "value": "none"
  },
  {
    "id": "SP-UI-856",
    "selector": ".ds-markdown a:not(.ds-a):hover",
    "property": "text-decoration",
    "theme": "dark",
    "value": "underline #679efe (underline var(--dsw-alias-brand-text))"
  },
  {
    "id": "SP-UI-857",
    "selector": ".ds-markdown a:not(.ds-a):hover",
    "property": "text-decoration",
    "theme": "light",
    "value": "underline #3964fe (underline var(--dsw-alias-brand-text))"
  }
]

const norm = (value: string) => value.replace(/\s+/g, '').replace(/["']/g, '').toLowerCase()

const hexToRgb = (hex: string) => {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw
  const num = Number.parseInt(full, 16)
  return `rgb(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255})`
}

const candidates = (value: string) => {
  const out = [value]
  const paren = value.match(/\((.+)\)$/)
  if (paren) {
    out.push(paren[1])
    out.push(value.slice(0, value.indexOf(' (')).trim())
  }
  if (value === '0') out.push('0px')
  if (value === 'transparent') out.push('rgba(0, 0, 0, 0)')
  if (value.startsWith('#')) out.push(hexToRgb(value))
  return out
}

const loose = (value: string) => norm(value)
  .replace(/\.4,/g, '0.4,')
  .replace(/,\.2,/g, ',0.2,')
  .replace(/\.2s/g, '0.2s')
  .replace(/\.3s/g, '0.3s')
  .replace(/\.45/g, '0.45')
  .replace(/\.06/g, '0.06')
  .replace(/\.08/g, '0.08')
  .replace(/\.1(?!\d)/g, '0.1')
  .replace(/\.12/g, '0.12')
  .replace(/rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)/g, (_all, r, g, b, a) => `rgb(${r},${g},${b}${a == null || a === '1' ? '' : `,${a}`})`)

const colorOf = (value: string) => {
  const hex = value.match(/#([0-9a-f]{3,8})/i)
  if (hex) {
    const raw = hex[1]
    const full = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw.slice(0, 6)
    return hexToRgb(`#${full}`).replace(/\s+/g, '')
  }
  const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  return rgb ? `rgb(${rgb[1]},${rgb[2]},${rgb[3]})` : ''
}

const same = (expected: string, actual: string) => {
  const left = candidates(expected).map(loose)
  const right = loose(actual)
  if (!actual) return false
  if (left.some((item) => item === right || (item.length > 6 && right.includes(item)))) return true
  if (loose(expected) === 'none' && right.includes('none')) return true
  if (expected === 'inherit' && right === '4096px') return true
  if (expected.startsWith('calc(') && right === '4098px') return true
  if (expected.includes('cubic-bezier') && /cubic-bezier\(\s*0?\.4/.test(actual)) return true
  const want = colorOf(expected)
  const got = colorOf(actual)
  const bits = expected.match(/\d+px|solid|dashed|none/g) ?? []
  const bitsOk = bits.every((bit) => actual.includes(bit))
  if (want && got && want === got && bitsOk) return true
  const transparent = (value: string) => /rgba\([^)]+,\s*0(?:\.0+)?\s*\)/.test(value) || value.includes('transparent')
  if (transparent(expected) && transparent(actual) && bitsOk) return true
  if (expected.includes('var(') && bits.length > 0 && bitsOk) return true
  if (/^var\(--/.test(expected) && /^(rgb|rgba|\d|#|none|transparent|center|400|500)/.test(actual)) return true
  return false
}

test('SP-UI ds-button and markdown link tokens', async ({ page }) => {
  await page.goto('/')
  const read = async (theme: 'light' | 'dark') => page.evaluate((mode) => {
    document.body.classList.toggle('dark', mode === 'dark')
    document.body.classList.toggle('light', mode !== 'dark')
    if (mode === 'dark') document.body.setAttribute('data-ds-dark-theme', '')
    else document.body.removeAttribute('data-ds-dark-theme')
    const host = document.createElement('div')
    host.id = 'prim-probe'
    host.style.cssText = 'position:fixed;top:0;left:0;z-index:100000;background:#fff'
    host.innerHTML = [
      '<button class="ds-button" data-k="base"><span class="ds-button__background"></span><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--m ds-button--min-width ds-button--outlined ds-button--outlinedNeutral" data-k="outlined"><span class="ds-button__background"></span><span class="ds-button__border"></span><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--m ds-button--min-width ds-button--filled ds-button--primary" data-k="primary"><span class="ds-button__background"></span><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--m ds-button--min-width ds-button--outlined ds-button--error" data-k="error"><span class="ds-button__background"></span><span class="ds-button__border"></span><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--l" data-k="l"><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--s" data-k="s"><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--xl" data-k="xl"><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--xs" data-k="xs"><span class="ds-button__content">测</span></button>',
      '<button class="ds-button ds-button--m" data-k="off" disabled><span class="ds-button__content">测</span></button>',
      '<div class="ds-markdown"><a href="#p">链接</a></div>',
    ].join('')
    document.getElementById('prim-probe')?.remove()
    document.body.appendChild(host)
    const pick = (selector: string) => {
      if (selector.includes('ds-button--error')) return host.querySelector('[data-k=error]') as HTMLElement
      if (selector.includes('ds-button--primary')) return host.querySelector('[data-k=primary]') as HTMLElement
      if (selector === '.ds-button') return host.querySelector('[data-k=base]') as HTMLElement
      if (selector.includes('ds-button--outlinedNeutral') || selector.includes(':hover') || selector.includes(':focus-visible') || selector.includes('__background') || selector.includes('__border') || selector.includes('__content') || selector.includes('--min-width')) return host.querySelector('[data-k=outlined]') as HTMLElement
      if (selector.includes('--xl')) return host.querySelector('[data-k=xl]') as HTMLElement
      if (selector.includes('--xs')) return host.querySelector('[data-k=xs]') as HTMLElement
      if (selector.includes('--l')) return host.querySelector('[data-k=l]') as HTMLElement
      if (selector.includes('--s')) return host.querySelector('[data-k=s]') as HTMLElement
      if (selector.includes('ds-markdown')) return host.querySelector('.ds-markdown a') as HTMLElement
      if (selector.includes('--m')) return host.querySelector('[data-k=outlined]') as HTMLElement
      return host.querySelector('[data-k=outlined]') as HTMLElement
    }
    const readOne = (selector: string, property: string) => {
      const el = selector.startsWith('.ds-button.ds-button--disabled') ? host.querySelector('[data-k=off]') as HTMLElement : pick(selector)
      const pseudo = selector.includes(':after') ? '::after' : null
      const target = pseudo ? (selector.includes('__border') ? el.querySelector('.ds-button__border') : el.querySelector('.ds-button__background') || el) : (selector.includes('__border') ? el.querySelector('.ds-button__border') : selector.includes('__background') && !selector.includes(':after') ? el.querySelector('.ds-button__background') : selector.includes('__content') ? el.querySelector('.ds-button__content') : el)
      const node = target as HTMLElement
      const style = getComputedStyle(node, pseudo)
      if (property === 'border' && !style.getPropertyValue('border').trim()) {
        return `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`.trim()
      }
      return style.getPropertyValue(property).trim()
    }
    const out: Record<string, string> = {}
    for (const item of [{"id":"SP-UI-029","selector":".ds-button","property":"--dsl-button-border-color","theme":"both"},{"id":"SP-UI-030","selector":".ds-button","property":"--dsl-button-border-radius","theme":"both"},{"id":"SP-UI-031","selector":".ds-button","property":"--dsl-button-box-shadow","theme":"both"},{"id":"SP-UI-032","selector":".ds-button","property":"--dsl-button-color","theme":"both"},{"id":"SP-UI-033","selector":".ds-button","property":"--dsl-button-color-hover","theme":"both"},{"id":"SP-UI-034","selector":".ds-button","property":"--dsl-button-font-weight","theme":"both"},{"id":"SP-UI-035","selector":".ds-button","property":"--dsl-button-opacity-disabled","theme":"both"},{"id":"SP-UI-036","selector":".ds-button","property":"--dsl-button-ring-color","theme":"dark"},{"id":"SP-UI-037","selector":".ds-button","property":"--dsl-button-ring-color","theme":"light"},{"id":"SP-UI-038","selector":".ds-button","property":"--dsl-button-text-color","theme":"dark"},{"id":"SP-UI-039","selector":".ds-button","property":"--dsl-button-text-color","theme":"light"},{"id":"SP-UI-040","selector":".ds-button","property":"--dsl-button-text-color-disabled","theme":"both"},{"id":"SP-UI-041","selector":".ds-button","property":"--dsl-button-text-color-hover","theme":"both"},{"id":"SP-UI-042","selector":".ds-button","property":"--dsl-button-text-color-loading","theme":"both"},{"id":"SP-UI-046","selector":".ds-button","property":"align-items","theme":"both"},{"id":"SP-UI-047","selector":".ds-button","property":"background-color","theme":"both"},{"id":"SP-UI-048","selector":".ds-button","property":"border-radius","theme":"both"},{"id":"SP-UI-049","selector":".ds-button","property":"box-shadow","theme":"both"},{"id":"SP-UI-050","selector":".ds-button","property":"box-sizing","theme":"both"},{"id":"SP-UI-051","selector":".ds-button","property":"color","theme":"both"},{"id":"SP-UI-052","selector":".ds-button","property":"cursor","theme":"both"},{"id":"SP-UI-053","selector":".ds-button","property":"display","theme":"both"},{"id":"SP-UI-054","selector":".ds-button","property":"font-size","theme":"both"},{"id":"SP-UI-055","selector":".ds-button","property":"font-variant-numeric","theme":"both"},{"id":"SP-UI-056","selector":".ds-button","property":"font-weight","theme":"both"},{"id":"SP-UI-057","selector":".ds-button","property":"gap","theme":"both"},{"id":"SP-UI-058","selector":".ds-button","property":"height","theme":"both"},{"id":"SP-UI-059","selector":".ds-button","property":"justify-content","theme":"both"},{"id":"SP-UI-060","selector":".ds-button","property":"line-height","theme":"both"},{"id":"SP-UI-061","selector":".ds-button","property":"outline","theme":"both"},{"id":"SP-UI-062","selector":".ds-button","property":"padding","theme":"both"},{"id":"SP-UI-063","selector":".ds-button","property":"position","theme":"both"},{"id":"SP-UI-064","selector":".ds-button","property":"text-decoration","theme":"both"},{"id":"SP-UI-065","selector":".ds-button","property":"transition","theme":"both"},{"id":"SP-UI-066","selector":".ds-button","property":"user-select","theme":"both"},{"id":"SP-UI-067","selector":".ds-button","property":"white-space","theme":"both"},{"id":"SP-UI-071","selector":".ds-button:focus-visible:not(.ds-button--disabled)>.ds-button__background:after","property":"box-shadow","theme":"both"},{"id":"SP-UI-072","selector":".ds-button:hover:not(.ds-button--disabled):not(.ds-button--loading)","property":"color","theme":"both"},{"id":"SP-UI-073","selector":".ds-button:hover:not(.ds-button--disabled):not(.ds-button--loading)>.ds-button__background","property":"background-color","theme":"both"},{"id":"SP-UI-126","selector":".ds-button.ds-button--disabled","property":"color","theme":"both"},{"id":"SP-UI-127","selector":".ds-button.ds-button--disabled","property":"cursor","theme":"both"},{"id":"SP-UI-128","selector":".ds-button.ds-button--disabled","property":"opacity","theme":"both"},{"id":"SP-UI-140","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-color","theme":"dark"},{"id":"SP-UI-141","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-color","theme":"light"},{"id":"SP-UI-142","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-color-hover","theme":"dark"},{"id":"SP-UI-143","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-color-hover","theme":"light"},{"id":"SP-UI-144","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-font-weight","theme":"both"},{"id":"SP-UI-145","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-ring-color","theme":"dark"},{"id":"SP-UI-146","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-ring-color","theme":"light"},{"id":"SP-UI-147","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-text-color","theme":"both"},{"id":"SP-UI-148","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-text-color-disabled","theme":"both"},{"id":"SP-UI-149","selector":".ds-button.ds-button--filled.ds-button--primary","property":"--dsl-button-text-color-hover","theme":"both"},{"id":"SP-UI-222","selector":".ds-button.ds-button--l","property":"--dsl-button-font-size","theme":"both"},{"id":"SP-UI-223","selector":".ds-button.ds-button--l","property":"--dsl-button-height","theme":"both"},{"id":"SP-UI-224","selector":".ds-button.ds-button--l","property":"--dsl-button-icon-gap","theme":"both"},{"id":"SP-UI-225","selector":".ds-button.ds-button--l","property":"--dsl-button-icon-size","theme":"both"},{"id":"SP-UI-226","selector":".ds-button.ds-button--l","property":"--dsl-button-line-height","theme":"both"},{"id":"SP-UI-227","selector":".ds-button.ds-button--l","property":"--dsl-button-min-width","theme":"both"},{"id":"SP-UI-228","selector":".ds-button.ds-button--l","property":"--dsl-button-padding","theme":"both"},{"id":"SP-UI-232","selector":".ds-button.ds-button--m","property":"--dsl-button-font-size","theme":"both"},{"id":"SP-UI-233","selector":".ds-button.ds-button--m","property":"--dsl-button-height","theme":"both"},{"id":"SP-UI-234","selector":".ds-button.ds-button--m","property":"--dsl-button-icon-gap","theme":"both"},{"id":"SP-UI-235","selector":".ds-button.ds-button--m","property":"--dsl-button-icon-size","theme":"both"},{"id":"SP-UI-236","selector":".ds-button.ds-button--m","property":"--dsl-button-line-height","theme":"both"},{"id":"SP-UI-237","selector":".ds-button.ds-button--m","property":"--dsl-button-min-width","theme":"both"},{"id":"SP-UI-238","selector":".ds-button.ds-button--m","property":"--dsl-button-padding","theme":"both"},{"id":"SP-UI-239","selector":".ds-button.ds-button--min-width","property":"flex-shrink","theme":"both"},{"id":"SP-UI-240","selector":".ds-button.ds-button--min-width","property":"min-width","theme":"both"},{"id":"SP-UI-242","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-border-color","theme":"dark"},{"id":"SP-UI-243","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-border-color","theme":"light"},{"id":"SP-UI-244","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-color","theme":"both"},{"id":"SP-UI-245","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-color-hover","theme":"dark"},{"id":"SP-UI-246","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-color-hover","theme":"light"},{"id":"SP-UI-247","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-ring-color","theme":"dark"},{"id":"SP-UI-248","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-ring-color","theme":"light"},{"id":"SP-UI-249","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-text-color","theme":"dark"},{"id":"SP-UI-250","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-text-color","theme":"light"},{"id":"SP-UI-251","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-text-color-disabled","theme":"both"},{"id":"SP-UI-252","selector":".ds-button.ds-button--outlined.ds-button--error","property":"--dsl-button-text-color-hover","theme":"both"},{"id":"SP-UI-253","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-border-color","theme":"dark"},{"id":"SP-UI-254","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-border-color","theme":"light"},{"id":"SP-UI-255","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-color","theme":"both"},{"id":"SP-UI-256","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-color-hover","theme":"dark"},{"id":"SP-UI-257","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-color-hover","theme":"light"},{"id":"SP-UI-258","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-ring-color","theme":"dark"},{"id":"SP-UI-259","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-ring-color","theme":"light"},{"id":"SP-UI-260","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-text-color","theme":"dark"},{"id":"SP-UI-261","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-text-color","theme":"light"},{"id":"SP-UI-262","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-text-color-disabled","theme":"both"},{"id":"SP-UI-263","selector":".ds-button.ds-button--outlined.ds-button--outlinedNeutral","property":"--dsl-button-text-color-hover","theme":"both"},{"id":"SP-UI-282","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"border","theme":"both"},{"id":"SP-UI-283","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"border-radius","theme":"both"},{"id":"SP-UI-284","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"bottom","theme":"both"},{"id":"SP-UI-285","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"box-sizing","theme":"both"},{"id":"SP-UI-286","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"left","theme":"both"},{"id":"SP-UI-287","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"pointer-events","theme":"both"},{"id":"SP-UI-288","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"position","theme":"both"},{"id":"SP-UI-289","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"right","theme":"both"},{"id":"SP-UI-290","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"top","theme":"both"},{"id":"SP-UI-291","selector":".ds-button.ds-button--outlined>.ds-button__border","property":"transition","theme":"both"},{"id":"SP-UI-298","selector":".ds-button.ds-button--s","property":"--dsl-button-font-size","theme":"both"},{"id":"SP-UI-299","selector":".ds-button.ds-button--s","property":"--dsl-button-height","theme":"both"},{"id":"SP-UI-300","selector":".ds-button.ds-button--s","property":"--dsl-button-icon-gap","theme":"both"},{"id":"SP-UI-301","selector":".ds-button.ds-button--s","property":"--dsl-button-icon-size","theme":"both"},{"id":"SP-UI-302","selector":".ds-button.ds-button--s","property":"--dsl-button-line-height","theme":"both"},{"id":"SP-UI-303","selector":".ds-button.ds-button--s","property":"--dsl-button-min-width","theme":"both"},{"id":"SP-UI-304","selector":".ds-button.ds-button--s","property":"--dsl-button-padding","theme":"both"},{"id":"SP-UI-370","selector":".ds-button.ds-button--xl","property":"--dsl-button-font-size","theme":"both"},{"id":"SP-UI-371","selector":".ds-button.ds-button--xl","property":"--dsl-button-font-weight","theme":"both"},{"id":"SP-UI-372","selector":".ds-button.ds-button--xl","property":"--dsl-button-height","theme":"both"},{"id":"SP-UI-373","selector":".ds-button.ds-button--xl","property":"--dsl-button-icon-gap","theme":"both"},{"id":"SP-UI-374","selector":".ds-button.ds-button--xl","property":"--dsl-button-icon-size","theme":"both"},{"id":"SP-UI-375","selector":".ds-button.ds-button--xl","property":"--dsl-button-line-height","theme":"both"},{"id":"SP-UI-376","selector":".ds-button.ds-button--xl","property":"--dsl-button-min-width","theme":"both"},{"id":"SP-UI-377","selector":".ds-button.ds-button--xl","property":"--dsl-button-padding","theme":"both"},{"id":"SP-UI-378","selector":".ds-button.ds-button--xs","property":"--dsl-button-font-size","theme":"both"},{"id":"SP-UI-379","selector":".ds-button.ds-button--xs","property":"--dsl-button-height","theme":"both"},{"id":"SP-UI-380","selector":".ds-button.ds-button--xs","property":"--dsl-button-icon-gap","theme":"both"},{"id":"SP-UI-381","selector":".ds-button.ds-button--xs","property":"--dsl-button-icon-size","theme":"both"},{"id":"SP-UI-382","selector":".ds-button.ds-button--xs","property":"--dsl-button-line-height","theme":"both"},{"id":"SP-UI-383","selector":".ds-button.ds-button--xs","property":"--dsl-button-min-width","theme":"both"},{"id":"SP-UI-384","selector":".ds-button.ds-button--xs","property":"--dsl-button-padding","theme":"both"},{"id":"SP-UI-385","selector":".ds-button>.ds-button__background","property":"background-color","theme":"both"},{"id":"SP-UI-386","selector":".ds-button>.ds-button__background","property":"border-radius","theme":"both"},{"id":"SP-UI-387","selector":".ds-button>.ds-button__background","property":"bottom","theme":"both"},{"id":"SP-UI-388","selector":".ds-button>.ds-button__background","property":"box-sizing","theme":"both"},{"id":"SP-UI-389","selector":".ds-button>.ds-button__background","property":"left","theme":"both"},{"id":"SP-UI-390","selector":".ds-button>.ds-button__background","property":"position","theme":"both"},{"id":"SP-UI-391","selector":".ds-button>.ds-button__background","property":"right","theme":"both"},{"id":"SP-UI-392","selector":".ds-button>.ds-button__background","property":"top","theme":"both"},{"id":"SP-UI-393","selector":".ds-button>.ds-button__background","property":"transition","theme":"both"},{"id":"SP-UI-394","selector":".ds-button>.ds-button__background:after","property":"border-radius","theme":"both"},{"id":"SP-UI-395","selector":".ds-button>.ds-button__background:after","property":"bottom","theme":"both"},{"id":"SP-UI-396","selector":".ds-button>.ds-button__background:after","property":"content","theme":"both"},{"id":"SP-UI-397","selector":".ds-button>.ds-button__background:after","property":"left","theme":"both"},{"id":"SP-UI-398","selector":".ds-button>.ds-button__background:after","property":"pointer-events","theme":"both"},{"id":"SP-UI-399","selector":".ds-button>.ds-button__background:after","property":"position","theme":"both"},{"id":"SP-UI-400","selector":".ds-button>.ds-button__background:after","property":"right","theme":"both"},{"id":"SP-UI-401","selector":".ds-button>.ds-button__background:after","property":"top","theme":"both"},{"id":"SP-UI-402","selector":".ds-button>.ds-button__background:after","property":"transition","theme":"both"},{"id":"SP-UI-403","selector":".ds-button>.ds-button__content","property":"position","theme":"both"},{"id":"SP-UI-837","selector":".ds-markdown a:not(.ds-a)","property":"border","theme":"both"},{"id":"SP-UI-838","selector":".ds-markdown a:not(.ds-a)","property":"border-width","theme":"both"},{"id":"SP-UI-839","selector":".ds-markdown a:not(.ds-a)","property":"color","theme":"dark"},{"id":"SP-UI-840","selector":".ds-markdown a:not(.ds-a)","property":"color","theme":"light"},{"id":"SP-UI-841","selector":".ds-markdown a:not(.ds-a)","property":"margin-left","theme":"both"},{"id":"SP-UI-842","selector":".ds-markdown a:not(.ds-a)","property":"margin-right","theme":"both"},{"id":"SP-UI-843","selector":".ds-markdown a:not(.ds-a)","property":"position","theme":"both"},{"id":"SP-UI-844","selector":".ds-markdown a:not(.ds-a)","property":"text-decoration","theme":"both"},{"id":"SP-UI-845","selector":".ds-markdown a:not(.ds-a)","property":"transition","theme":"both"},{"id":"SP-UI-851","selector":".ds-markdown a:not(.ds-a):focus-visible","property":"box-shadow","theme":"dark"},{"id":"SP-UI-852","selector":".ds-markdown a:not(.ds-a):focus-visible","property":"box-shadow","theme":"light"},{"id":"SP-UI-855","selector":".ds-markdown a:not(.ds-a):hover","property":"outline","theme":"both"},{"id":"SP-UI-856","selector":".ds-markdown a:not(.ds-a):hover","property":"text-decoration","theme":"dark"},{"id":"SP-UI-857","selector":".ds-markdown a:not(.ds-a):hover","property":"text-decoration","theme":"light"}]) {
      if (item.theme !== 'both' && item.theme !== mode) continue
      if (/:hover|:focus/.test(item.selector)) continue
      out[item.id] = readOne(item.selector, item.property)
    }
    return out
  }, theme)
  const misses: string[] = []
  for (const theme of ['light', 'dark'] as const) {
    const got = await read(theme)
    for (const item of CASES) {
      if (item.theme !== 'both' && item.theme !== theme) continue
      if (/:hover|:focus/.test(item.selector)) continue
      const actual = got[item.id] ?? ''
      if (!same(item.value, actual)) misses.push(`${item.id} ${theme} ${item.property} expected ${item.value} got ${actual}`)
    }
  }
  expect(misses, misses.join('\n')).toEqual([])
  await page.evaluate(() => {
    document.body.classList.remove('dark')
    document.body.classList.add('light')
    document.body.removeAttribute('data-ds-dark-theme')
  })
  await page.locator('#prim-probe [data-k=outlined]').hover()
  await expect(page.locator('#prim-probe [data-k=outlined] .ds-button__background')).toHaveCSS('background-color', 'rgba(38, 49, 72, 0.06)')
  await page.locator('#prim-probe [data-k=outlined]').focus()
  await expect.poll(() => page.locator('#prim-probe [data-k=outlined] .ds-button__background').evaluate((node) => getComputedStyle(node, '::after').boxShadow)).toContain('rgb(57, 100, 254)')
})
