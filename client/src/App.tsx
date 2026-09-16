import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useForebitPolling } from "@/hooks/use-forebit-polling";
import { useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";

// Pages
import AuthPage from "@/pages/AuthPage";
import LogsPage from "@/pages/LogsPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import OrderDetailPageNew from "@/pages/OrderDetailPageNew";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/not-found";
import DepositPage from "@/pages/DepositPage";
import OrdersPage from "@/pages/OrdersPage";
import MyCodePage from "@/pages/MyCodePage";
import CartPage from "@/pages/CartPage";
import RanksPage from "@/pages/RanksPage";
import WorkerDashboardPage from "@/pages/WorkerDashboardPage";
import CardsPage from "@/pages/CardsPage";
import CheckerPage from "@/pages/CheckerPage";
import BecomeResellerPage from "@/pages/BecomeSellerPage";
import ProfilePage from "@/pages/ProfilePage";
import SupportPage from "@/pages/SupportPage";
import RedeemCodePage from "@/pages/RedeemCodePage";

function LoadingScreen() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Connecting to TurtleCC…</p>
    </main>
  );
}

function ConnectionErrorScreen({ retry }: { retry: () => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Unable to connect</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The app server did not respond. Check the deployment configuration and try again.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void retry()}
        className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </main>
  );
}

function Router() {
  const { user, isLoading, isError, retryAuth } = useAuth();
  const [location, setLocation] = useLocation();
  useForebitPolling();

  useEffect(() => {
    if (!isLoading && !isError && !user && !["/auth", "/forgot-password"].includes(location)) {
      setLocation("/auth");
    }
  }, [user, isLoading, isError, location, setLocation]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return <ConnectionErrorScreen retry={retryAuth} />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/forgot-password" component={AuthPage} />
        <Route path="/" component={CardsPage} />
        <Route path="/deposit" component={DepositPage} />
        <Route path="/shop" component={LogsPage} />
        <Route path="/redeem" component={RedeemCodePage} />
        <Route path="/product/:name" component={ProductDetailPage} />
        <Route path="/order/:id" component={OrderDetailPageNew} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/my-code" component={MyCodePage} />
        <Route path="/cart" component={CartPage} />
        <Route path="/ranks" component={RanksPage} />
        <Route path="/worker" component={WorkerDashboardPage} />
        <Route path="/cards" component={CardsPage} />
        <Route path="/checker" component={CheckerPage} />
        <Route path="/become-reseller" component={BecomeResellerPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/admin">
          {() => <AdminPage />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
