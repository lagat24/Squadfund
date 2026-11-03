import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Groups from "./pages/Groups.jsx";
import CreateGroup from "./pages/CreateGroup.jsx";
import JoinGroup from "./pages/JoinGroup.jsx";
import GroupLayout from "./pages/GroupLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Plan from "./pages/Plan.jsx";
import Contribute from "./pages/Contribute.jsx";
import PaymentResult from "./pages/PaymentResult.jsx";
import Ledger from "./pages/Ledger.jsx";
import Coach from "./pages/Coach.jsx";
import Offer from "./pages/Offer.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="groups" element={<Groups />} />
        <Route path="start" element={<CreateGroup />} />
        <Route path="join" element={<JoinGroup />} />
        <Route path="join/:code" element={<JoinGroup />} />
        <Route path="g/:id" element={<GroupLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="plan" element={<Plan />} />
          <Route path="contribute" element={<Contribute />} />
          <Route path="payments/:cid" element={<PaymentResult />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="coach" element={<Coach />} />
          <Route path="offer" element={<Offer />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
