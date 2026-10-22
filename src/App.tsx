import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";

// Each area is its own chunk: a worker's phone never downloads the admin screens.
const Track = lazy(() => import("./pages/Track"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const TeamLogin = lazy(() => import("./pages/team/Login"));
const TeamQueue = lazy(() => import("./pages/team/Queue"));
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const OrderForm = lazy(() => import("./pages/admin/OrderForm"));
const OrderDetail = lazy(() => import("./pages/admin/OrderDetail"));
const TeamSettings = lazy(() => import("./pages/admin/TeamSettings"));
const Customers = lazy(() => import("./pages/admin/Customers"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="p-6 text-muted">…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:trackingNo" element={<Track />} />
          <Route path="/my" element={<MyOrders />} />
          <Route path="/team/login" element={<TeamLogin />} />
          <Route path="/team" element={<TeamQueue />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders/new" element={<OrderForm />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="orders/:id/edit" element={<OrderForm />} />
            <Route path="team" element={<TeamSettings />} />
            <Route path="customers" element={<Customers />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
