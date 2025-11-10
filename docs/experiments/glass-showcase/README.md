# Glass Morphism Showcase

A beautiful demonstration page featuring custom glass morphism CSS effects.

## Features

### 🎨 5 Background Animation Templates
Users can select from 5 different animated backgrounds:
1. **Sunset Wave** - Smooth wave motion from center to top
2. **Ocean Drift** - Left to right panning movement
3. **Galaxy Pulse** - Zoom and brightness pulsing effect
4. **Mountain Pan** - 360-degree circular panning
5. **Aurora Zoom** - Dynamic zoom in/out effect

### 🎯 Components Included

#### Cards
- **Feature Card** - With description and call-to-action button
- **Stats Card** - Large number display with label
- **Music Player Card** - Interactive player interface with controls (2 variations)
- **Header Card** - Large title and subtitle display

#### Buttons
- **Primary Button** - Default glass effect
- **Secondary Button** - Lighter glass background
- **Accent Button** - Red accent color
- **Outline Button** - Transparent with border
- **SVG Control Buttons** - Transparent buttons with SVG icons

#### Navigation & Menus
- **Tab Navigation** - Interactive tabs with emoji icons
- **Icon Menu** - Home, New, Wifi, Library navigation
- **Search Widget** - Large and small search components
- **App Dock** - macOS-style dock with app icons (Finder, Maps, Messages, Safari, Books)

#### Music Players
- **Player 1** - "Summer Vibes" by Ambient Sounds (emoji controls)
- **Player 2** - "All Of Me" by Nao (SVG controls)

#### Special Effects
- **Backdrop blur** - Frosted glass effect
- **Specular highlights** - Light reflections on glass
- **Drop shadows** - Depth and elevation
- **Smooth transitions** - All interactions animated
- **Entrance animations** - Staggered fade-in on load
- **Hover scale effects** - Interactive feedback on all clickable elements

## File Structure

```
app/glass-showcase/
├── page.tsx           # Main React component
├── glass-styles.css   # All custom CSS styles
└── README.md         # This file
```

## CSS Architecture

### Custom Properties
```css
--lg-bg-color: rgba(255, 255, 255, 0.25)  /* Glass background */
--lg-highlight: rgba(255, 255, 255, 0.75) /* Specular highlights */
--lg-text: #ffffff                         /* Text color */
--lg-red: #fb4268                          /* Accent color */
--lg-grey: #444739                         /* Secondary text */
```

### Glass Container Structure
Each glass element has three layers:
1. **Glass Filter** - Backdrop blur and color adjustments
2. **Glass Overlay** - Semi-transparent background
3. **Glass Specular** - Highlight and shine effects

## Usage

Visit the page at `/glass-showcase` to see all effects in action.

Click the "🎨 Change Background" button in the top-right to switch between background animations.

## Responsive Design

The page is fully responsive with breakpoints at 768px for mobile devices:
- Stacked layouts on mobile
- Adjusted button sizes
- Responsive grid for background picker

## Animation Details

All background animations run for 5 seconds in an infinite alternate loop, creating smooth, continuous motion without jarring resets.

## Browser Support

Works best in modern browsers with support for:
- `backdrop-filter`
- CSS custom properties
- CSS Grid and Flexbox
- CSS animations and transitions

