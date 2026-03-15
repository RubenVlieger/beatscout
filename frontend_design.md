Here is a comprehensive, deep-dive specification document designed for a front-end developer or an AI coding agent to recreate this UI, incorporating all of your requested modifications, fixed spelling errors, and new features. 

---

# UI/UX Recreation Specification: BeatScout Dashboard

## 1. Global Design System & Theme
*   **Overall Theme:** Dark mode, highly technical, sleek dashboard. Focuses on data visualization.
*   **Primary Font:** A modern, clean sans-serif (e.g., Inter, Roboto, or SF Pro Display).
*   **Color Palette (Approximations):**
    *   **App Background:** Deep charcoal/almost black (`#141619`).
    *   **Panel Backgrounds:** Slightly lighter dark gray (`#1C2024`) with subtle borders (`#2D3238`).
    *   **Accent/Primary Color:** Neon mint green (`#68ED9E`). Used for primary buttons, active states, and success text.
    *   **Text Colors:** Primary text is off-white (`#E0E0E0`). Secondary text (labels, deactivated items) is light gray (`#8B949E`).
    *   **Graph Colors:** Dark Blue (`#1E3A8A`) to Bright Yellow (`#FACC15`).
*   **Layout Structure:** CSS Grid or Flexbox. Fixed left sidebar (approx. 250px wide) and a fluid main content area. The main content area sits inside an overarching "app window" with rounded corners, placed on a slightly lighter background, resembling a web app inside a browser window.

---

## 2. Left Sidebar Component
*   **Header:** 
    *   Logo: Vertical soundwave icon (3 bars) next to text "BeatScout" in bold, white font.
*   **User Profile (Top Right of App, moved from original layout for better UX, or keep in sidebar top):**
    *   Avatar circle next to text: `DJ Name: 'Ctrl_Alt_Dance'`
*   **Navigation Links (Vertical List):**
    *   *Requirement:* Fix spelling ("Requeet" -> "Request"). Add "Recommended".
    *   Icons: Use minimalist line-art icons for each.
    *   List Items:
        1.  `Dashboard`
        2.  `Request New Track` (Spelling fixed)
        3.  `My Crate`
        4.  `Recommended` **[NEW REQUIREMENT]**
        5.  `Analytics`
        6.  `Settings`
    *   *Styling:* Active state should have a subtle background highlight and icon color change.

---

## 3. Top Header Component (Main Content Area)
*   **Title:**
    *   Text: `AI-Powered Edit Discovery for [Song Request: Peggy Gou - It Goes Like Nanana]`
    *   Style: Large, prominent, white text.
*   **Status Bar:**
    *   Background: Very dark green/gray, thin pill shape.
    *   Icon: Small green checkmark.
    *   Text: `Analysis complete: 187 unique edits found, 1705 Cached Results`
*   **Call to Action (Top Right):**
    *   Button text: `Upgrade to Pro for Priority Analysis`
    *   Style: Solid fill using the Accent neon green color, black text, pill shape, slight hover effect.

---

## 4. Main Data Visualization Component: The "Edit Explorer" 
*This section contains the core modifications requested.*

*   **Panel Header:** Text `Edit Explorer` on the left, `Interact visualization v` (dropdown) on the right.
*   **The 3D Graph (Crucial Requirements):**
    *   *Type:* 3D Scatter Plot. **Remove the connecting web/mesh lines seen in the original image.** It must be individual floating data points.
    *   *Data Distribution:* Points must appear **randomly dispersed** throughout the 3D space, avoiding the tight central cluster seen in the original image.
    *   **Axis 1 (X-Axis):** `Tempo (BPM)`
        *   Scale: 80 to 180.
    *   **Axis 2 (Y-Axis):** `Danceability`
        *   Scale: 0.0 to 100.0.
    *   **Axis 3 (Z-Axis):** `Temperament`
        *   *Special Requirement:* This axis requires descriptive text labels alongside numbers (0-100).
        *   Low end (0-33): Label as `Dark/Tense`.
        *   Middle (34-66): Label as `Neutral`.
        *   High end (67-100): Label as `Upbeat/Bright`.
*   **Color Mapping & Legend (Right side of graph):**
    *   Title: `Production Quality` (Spelling fixed from "Qualtiy").
    *   Style: A vertical color gradient bar.
    *   *Special Requirement:*
        *   Bottom of bar (Value 0): **Dark Blue** (Label text next to it: `Home Studio Vibe`).
        *   Top of bar (Value 100): **Bright Yellow** (Label text next to it: `Pro Quality`).
        *   The individual dots in the 3D scatter plot must be colored based on this scale.

*   **Filters Panel (Right side of the Edit Explorer box):**
    *   Title: `Filters`
    *   *Component 1:* `Genre` **[NEW REQUIREMENT]**. UI should be a multi-select dropdown menu or a horizontal scrollable row of selectable "chips" (e.g., Tech House, Techno, Disco).
    *   *Component 2:* `Tempo Range` (Dual-handle slider, 120 - 130 BPM).
    *   *Component 3:* `Danceability` (Dual-handle slider, Low to High).
    *   *Component 4:* `Temperament` (Dual-handle slider, Dark to Bright).

---

## 5. Data Table Component: "Top Edits for Nanana"
*Requirement: Fix multiple spelling errors from the original image.*

*   **Panel Header:** `Top Edits for Nanana`
*   **Table Layout:** 5 data columns, 2 action columns. Rows separated by very faint, dark borders.
*   **Columns & Data Mapping (Fixing spelling):**
    1.  **Title:** e.g., `It Goes Like Nanana - [DJ Name] Bootleg`
    2.  **Artist:** (Fixed from "Artlst") e.g., `Ctrl_Alt_Dance` (Fixed from "Otn_Alt_Dance").
    3.  **BPM:** e.g., `120`
    4.  **Key:** e.g., `9A`
    5.  **Score:** `Production Quality Score: 72` (Changing "Popularity" to the new requested metric, scaling 0-100).
*   **Action Buttons (Far Right of each row):**
    *   **Preview:** Dark background button with a white "Play" triangle icon and text `Preview`.
    *   **Download:** (Fixed from "Downlead"). Outline style button using the neon green accent color. Green download icon (arrow pointing down into a bracket) + green text `Download`.

---

## 6. Footer Component
*   Positioned at the very bottom, outside the main rounded app window.
*   Left text: `BeatScout - Confidential Investor Pitch Deck` (Spelling fixed from "BeatSoout").
*   Right text: `Powered by AWS for Startups`.
*   Font style: Very small, muted gray, minimalist.
