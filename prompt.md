Vantablock Front-End Prototype Build Prompt

Build a fully functional front-end prototype, no backend, for a Minecraft server hosting company called Vantablock. Use React as the framework, styled with a modern black-and-violet dark theme, premium and sleek, similar aesthetically to brands like Vercel or Linear. Avoid a generic AI-generated template look, avoid overused purple gradients, gradient blobs, and cliche SaaS layouts. Use a sophisticated dark palette with deep black backgrounds and rich violet accents, subtle glow effects, clean modern typography, and thoughtful spacing.

Vantablock offers dedicated Minecraft server hosting powered by high-performance AMD Ryzen 9 processors and DDR5 6000 megahertz memory, positioned as reasonably priced but premium and high performance.

Build these pages with full front-end interactivity using mock data and local state, no real backend calls, but everything should visually function: buttons, forms, toggles, tabs, and navigation should all work.

PAGE 1: Landing Page

Hero section with a strong headline and call to action
Features section highlighting Ryzen 9 processors, DDR5 memory, DDoS protection, and instant setup
Pricing section with multiple tiers based on RAM amounts (4GB, 8GB, 16GB, 32GB), each with a price, specs, and CTA button
Testimonials or social proof section
Footer with company links

PAGE 2: Auth

Login page and separate registration page, fully styled with form validation behavior using local state, no real authentication needed

PAGE 3: Client Dashboard Home

Overview of the user's servers as cards, each showing server name, status (online/offline), RAM usage, CPU usage, and a quick action menu (start, stop, restart, manage)
Account balance or billing summary widget
Quick stats overview at the top (total servers, active servers, resource usage)

PAGE 4: Server Management Panel (styled to resemble Bloom.Host's DuckPanel / Pterodactyl-style panel)

Console tab with live-looking mock console output and a command input bar
Start / Stop / Restart / Kill controls with visual status indicator
File manager tab with a mock file/folder browser, upload button, and basic file actions (rename, delete, edit)
Player list / players online tab with mock player data and kick/ban buttons
Server settings tab: server name, MOTD, version, allocated RAM slider, port info
Backups tab with mock backup list, create backup button, restore/delete actions
Scheduled tasks tab with mock cron-like task list
Sidebar navigation between these tabs, matching the dark black-and-violet theme

PAGE 5: Billing / Plans Page

Current plan display, mock invoices list, upgrade/downgrade plan flow, add payment method modal (front-end only, no real payment processing)

PAGE 6: Account Settings Page

Profile info editing, password change form, two-factor auth toggle (visual only), notification preferences

General Requirements

Fully responsive layout
Consistent black-and-violet design system across all pages (define reusable components: buttons, cards, inputs, modals, tabs, badges)
Use realistic mock data throughout, no lorem ipsum, no placeholder-looking content
Smooth micro-interactions and hover states, transitions should feel premium, not flashy
Navigation between all pages should work via React Router or equivalent
Code should be clean, componentized, and organized into logical folders (pages, components, layouts, mock-data)
This is a prototype for demonstration purposes, so all data can be hardcoded or stored in local component state, but the UI must feel like a real, finished, production-grade product, not a demo or AI-generated draft
