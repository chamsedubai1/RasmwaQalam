import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { UserRoleProvider } from "@/hooks/use-user-role";
import Header from "@/components/site/header";
import Footer from "@/components/site/footer";
import Home from "@/pages/home";
import About from "@/pages/about";
import Events from "@/pages/events";
import Gallery from "@/pages/gallery";
import Schools from "@/pages/schools";
import Partners from "@/pages/partners";
import CreArt from "@/pages/creart";
import TeacherDashboard from "@/pages/teacher-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";

function Router() {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 min-h-[calc(100vh-150px)]">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/about" component={About} />
          <Route path="/events" component={Events} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/schools" component={Schools} />
          <Route path="/partners" component={Partners} />
          <Route path="/creart" component={CreArt} />
          <Route path="/teacher" component={TeacherDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserRoleProvider>
        <Router />
        <Toaster />
      </UserRoleProvider>
    </QueryClientProvider>
  );
}

export default App;
