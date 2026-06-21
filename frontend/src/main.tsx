import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import './index.css';

// Initialize i18n
import './utils/i18n';

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <RouterProvider router={router} />
);
