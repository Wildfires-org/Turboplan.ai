import React from "react";

import {
  Calendar,
  CheckSquare,
  MessageCircle,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

interface TasksEmptyProps {
  isPreview?: boolean;
}

export const TasksEmpty: React.FC<TasksEmptyProps> = ({
  isPreview = false,
}) => {
  return (
    <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
      <div className="flex flex-col items-center space-y-8 text-center max-w-lg mx-auto px-6">
        {/* Animated Icons */}
        <div className="relative">
          {/* Central Circle */}
          <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center">
            {isPreview ? (
              <Sparkles className="w-10 h-10 text-indigo-500" />
            ) : (
              <MessageCircle className="w-10 h-10 text-indigo-500" />
            )}
          </div>

          {/* Floating Icons */}
          <div
            className="absolute -top-3 -left-3 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center animate-bounce"
            style={{ animationDelay: "0s", animationDuration: "2s" }}
          >
            <CheckSquare className="w-4 h-4" />
          </div>
          <div
            className="absolute -top-3 -right-3 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center animate-bounce"
            style={{ animationDelay: "0.5s", animationDuration: "2s" }}
          >
            <Target className="w-4 h-4" />
          </div>
          <div
            className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center animate-bounce"
            style={{ animationDelay: "1s", animationDuration: "2s" }}
          >
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        {/* Empty State Text */}
        <div className="space-y-3">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {isPreview
              ? "This version has no tasks yet"
              : "Ready to plan your project?"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
            {isPreview
              ? "This document version doesn't contain any milestones or tasks to display."
              : "Chat with AI to create your project structure. Describe your goals and the AI will generate milestones and tasks automatically."}
          </p>
        </div>

        {/* AI Chat Encouragement (only for non-preview) */}
        {!isPreview && (
          <div className="flex items-center space-x-3 px-6 py-4 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
            <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                AI-Powered Planning
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Describe your project and let AI create the structure
              </p>
            </div>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 w-full">
          <div className="flex flex-col items-center space-y-2 p-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-blue-500" />
            </div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200">
              AI Planning
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Intelligent project structure generation through chat
            </p>
          </div>

          <div className="flex flex-col items-center space-y-2 p-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-500" />
            </div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200">
              Timeline View
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Visualize your project timeline with Gantt charts
            </p>
          </div>

          <div className="flex flex-col items-center space-y-2 p-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-500" />
            </div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200">
              Smart Tracking
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Track progress and collaborate with your team
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
