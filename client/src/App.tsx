import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ChessGame from "@/pages/chess-game";
import AuthPage from "@/pages/auth";
import { useState, useEffect } from "react";

function Router() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on app load
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // First check for guest user in localStorage
      const guestUser = localStorage.getItem('guestUser');
      if (guestUser) {
        setUser(JSON.parse(guestUser));
        setIsLoading(false);
        return;
      }

      // Then check for authenticated session
  const response = await fetch("/api/auth/session", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.log("No active session");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    checkSession();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.3em] text-white/80">
          Загрузка...
        </div>
      </div>
    );
  }

  // Show auth page if no user
  if (!user) {
    return <AuthPage onSuccess={handleAuthSuccess} />;
  }

  // Show main app if user is authenticated
  return (
    <Switch>
      <Route path="/" component={ChessGame} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
