# Ranno.ai: Your Personal AI-Powered Running Route Planner

<p align="center">
  <img src="src/assets/logo.png" alt="Ranno.ai Logo" width="200"/>
</p>

## Table of Contents
- [Ranno.ai: Your Personal AI-Powered Running Route Planner](#rannoai-your-personal-ai-powered-running-route-planner)
  - [Table of Contents](#table-of-contents)
  - [1. Project Overview](#1-project-overview)
  - [2. Problem Solved](#2-problem-solved)
  - [3. Key Features](#3-key-features)
  - [4. Technology Stack](#4-technology-stack)
  - [5. How to Run the Project](#5-how-to-run-the-project)
    - [5.1. Prerequisites](#51-prerequisites)
    - [5.2. Installation](#52-installation)
    - [5.3. Configuration](#53-configuration)
    - [5.4. Start Development Server](#54-start-development-server)
    - [5.5. Access](#55-access)
  - [6. Future Enhancements](#6-future-enhancements)

---

## 1. Project Overview

While popular running apps like Strava and Keep are great for discovering routes based on community data, they often generate paths that lack personalization. These recommendations frequently ignore the common, real-world needs of runners, such as safety considerations (e.g., finding a well-lit route for a night run), preferred incline, scenery, or the availability of water fountains and public restrooms. Ranno.ai is built to address this gap.

Our application empowers users to express their complex route preferences and safety concerns using natural, conversational language. Instead of navigating confusing filters, you can simply tell our AI what you need.

Ultimately, Ranno.ai generates a highly intelligent and personalized running route tailored specifically for you, empowering your fitness journey.

## 2. Problem Solved

Traditional running applications often provide a one-size-fits-all experience, failing to address the nuanced needs of individual runners. Ranno.ai tackles these critical gaps head-on:

* **Generic Route Recommendations:** Most apps suggest popular routes but cannot accommodate complex, personal preferences. They can't answer requests like, "I want a quiet, scenic run on a trail surface, avoiding major hills." Ranno.ai moves beyond basic distance and time to understand *how* you want to run.

* **Critical Safety Oversight:** Runner safety, especially for those in unfamiliar cities or running at night, is a major unsolved problem. Existing solutions lack dynamic, real-time safety data, forcing users to manually vet routes or risk running in potentially unsafe areas.

* **Cumbersome User Experience:** Planning a specific route in conventional apps often requires navigating complex menus, applying multiple filters, and manual map adjustments. Ranno.ai streamlines this entire process into a single, intuitive natural language command.

## 3. Key Features

Ranno.ai is designed from the ground up to be your intelligent running partner, capable of understanding your most detailed requests. Our core features are powered by the seamless integration of on-device AI and cloud-based data:

* **🤖 AI-Powered Natural Language Understanding (NLU):** At the heart of Ranno.ai, Gemini Nano interprets complex, conversational user requests into our highly detailed `RunGeniusIntent` (V2 JSON schema). This allows for granular control over every aspect of your run, capturing:
    * **Location:** Specific `origin`, `destination`, `context` (e.g., "inside Golden Gate Park"), and `points_of_interest`.
    * **Constraints:** Precise `distance_km`, `duration_minutes`, and `time_of_day`.
    * **Preferences:** `route_type` (loop/point-to-point), `incline` (low/medium/high), `surface` (paved/trail/track), `safety` (avoid high-crime/prefer well-lit), `environment` (shaded/low-traffic), `scenery` (water/bridge/park view), `vibe` (quiet/lively), and `amenities` (restrooms/water fountains).

* **🛡️ Intelligent Safety-First Routing:** This is our killer feature. The system proactively generates routes that **minimize exposure to high-risk areas**. It integrates real-time safety data and intelligently routes you away from danger zones, making it ideal for night runs or when exploring new places.

* **🗺️ Dynamic Safety Heatmap Overlay:** We provide a transparent layer of local safety conditions (powered by crime data APIs) directly on the map. This gives you complete situational awareness and empowers you to make informed decisions about your route's safety profile.

* **⚙️ Deep & Granular Personalization:** Our engine goes far beyond basic distance to tailor routes precisely to your expressed desires across all dimensions of the `RunGeniusIntent` schema.

* **📍 Smart Point-of-Interest Integration:** Easily include desired landmarks (`points_of_interest`) or specify areas/features to `avoid` in your route planning.

## 4. Technology Stack

We use a modern, hybrid-AI technology stack to deliver a responsive, private, and powerful user experience.

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | **React (with Vite)** | For a fast, modern, and component-based user interface. |
| **Language** | **TypeScript** | For robust, type-safe code, crucial for managing complex data. |
| **Core AI (On-Device)** | **Chrome Prompt API (Gemini Nano)** | For on-device, privacy-preserving NLU to parse user intent. |
| **Mapping & Routing** | **Google Maps JavaScript API** | Powering our core `Directions Service`, `Places API`, and `Geometry Library`. |
| **Safety Data** | **San Francisco Crime Data API** | (Our initial data source) To fetch and process real-time safety data. |
| **Other Data** | **San Francisco Bathrooms/Water Fountain Data API** | (Our initial data source) To fetch and process real-time safety data. |
| **Deployment** | **Vercel** | For seamless, Git-based continuous deployment and hosting. |

## 5. How to Run the Project

Follow these steps to get Ranno.ai up and running on your local machine.

### 5.1. Prerequisites 

* **Google Chrome Canary (or equivalent Chrome version that supports Prompt API, e.g., Chrome 138+):** The Prompt API is an experimental feature.
* **Enabled Chrome Flags:** Visit `chrome://flags` in your browser and enable `#enable--on-device-model`.
* **Downloaded Gemini Nano Model:** See [Gemini Nano Official Website](https://developer.chrome.com/docs/ai/prompt-api).
* **Node.js (LTS version recommended) & npm (or yarn):** For managing project dependencies.
* **A Google Cloud API Key with Google Maps JavaScript API enabled:** For map rendering and route services.

### 5.2. Installation

1.  **Clone the repository:**
    ```bash
    git clone [Your Project Repo URL]
    cd Ranno.ai
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### 5.3. Configuration

1.  **Create a `.env` file** in the project root directory.
2.  **Add your Google Maps API Key** to the `.env.local` file:
    ```
    VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
    VITE_SFGOV_APP_TOKEN=YOUR_SFGOV_APP_TOKEN_HERE
    ```
    (Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` and `YOUR_SFGOV_APP_TOKEN_HERE` with your actual keys/tokens. **Do not commit your actual keys to public repositories.**)


### 5.4. Start Development Server

```bash
npm run dev
```

### 5.5. Access
Open your browser and navigate to 
```
http://localhost:5173/
```
The application will first check for AI model availability, then load the main interface.

## 6. Future Enhancements
Ranno.ai is built with scalability and future innovation in mind. Here are some potential enhancements:

* **Multi-modal Input:** Extend NLU to support voice commands for route requests, allowing a truly hands-free experience. Explore image analysis to understand desired running environments from user photos.

* **Adaptive Learning & User Profiles:** Implement a system to learn individual user preferences over time, automatically suggesting more personalized routes based on past activity, feedback, and biometric data (e.g., heart rate zones).

* **Social & Community Features:** Enable users to share favorite routes, participate in group runs, and receive real-time safety alerts from a community network.

* **Wearable Integration:** Connect with popular fitness trackers (e.g., Garmin, Apple Watch) for real-time performance monitoring, dynamic route adjustments based on fatigue, and post-run analysis.

* **Cross-platform Deployment:** Explore packaging Ranno.ai as a Progressive Web App (PWA) or a dedicated mobile application for broader accessibility.

* **Dynamic Weather Integration:** Incorporate real-time weather data to suggest routes that offer optimal conditions (e.g., avoiding strong winds, seeking shade on hot days).