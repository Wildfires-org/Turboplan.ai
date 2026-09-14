import React from "react";

import {
  Globe,
  Loader2,
  Map as MapIcon,
  MapPin,
  Navigation,
} from "lucide-react";

interface MapLoaderProps {
  message?: string;
}

export const MapLoader: React.FC<MapLoaderProps> = ({
  message = "Loading map data...",
}) => {
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center space-y-8 text-center max-w-md mx-auto px-6">
        {/* Animated Icons */}
        <div className="relative">
          {/* Main Spinner */}
          <div className="relative w-16 h-16">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          </div>

          {/* Floating Map Icons */}
          <div
            className="absolute -top-2 -left-2 w-6 h-6 text-green-500 animate-bounce"
            style={{ animationDelay: "0s" }}
          >
            <MapIcon className="w-6 h-6" />
          </div>
          <div
            className="absolute -top-2 -right-2 w-6 h-6 text-red-500 animate-bounce"
            style={{ animationDelay: "0.2s" }}
          >
            <MapPin className="w-6 h-6" />
          </div>
          <div
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 text-purple-500 animate-bounce"
            style={{ animationDelay: "0.4s" }}
          >
            <Navigation className="w-6 h-6" />
          </div>
          <div
            className="absolute top-1/2 -left-8 transform -translate-y-1/2 w-5 h-5 text-orange-500 animate-bounce"
            style={{ animationDelay: "0.6s" }}
          >
            <Globe className="w-5 h-5" />
          </div>
        </div>

        {/* Loading Text */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            {message}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Processing geospatial data...
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex space-x-2">
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
            style={{ animationDelay: "0.4s" }}
          />
          <div
            className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"
            style={{ animationDelay: "0.6s" }}
          />
        </div>

        {/* Feature List */}
        <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1 mt-8">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1 h-1 bg-green-400 rounded-full" />
            <span>Parsing geospatial layers</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1 h-1 bg-blue-400 rounded-full" />
            <span>Processing coordinates</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1 h-1 bg-purple-400 rounded-full" />
            <span>Preparing map visualization</span>
          </div>
        </div>
      </div>
    </div>
  );
};
