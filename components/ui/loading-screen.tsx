"use client";
import { motion } from "framer-motion";
import { LoaderThree } from "./loader";

interface LoadingScreenProps {
  isVisible: boolean;
  message?: string;
}

export default function LoadingScreen({ isVisible, message = "Loading..." }: LoadingScreenProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="relative">
          <LoaderThree />
        </div>
        
        <motion.p
          className="text-white text-lg md:text-xl font-medium text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {message}
        </motion.p>
      </motion.div>
    </motion.div>
  );
} 