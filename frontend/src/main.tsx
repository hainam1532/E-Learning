import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import './index.css';
import './utils/i18n';
import HealthCheck from './components/HealthCheck';

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <HealthCheck>
    <RouterProvider router={router} />
  </HealthCheck>
);
