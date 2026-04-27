import { useAuth } from "../contexts/AuthContext.jsx";
import {
  DEMO_SCENARIO_OPTIONS,
  getDemoScenarioById,
} from "../data/demoScenarios.js";

export default function useDemoScenario() {
  const { demoScenarioId, setDemoScenarioId } = useAuth();
  const scenario = getDemoScenarioById(demoScenarioId);

  return {
    scenario,
    scenarioId: scenario.id,
    scenarioOptions: DEMO_SCENARIO_OPTIONS,
    setScenarioId: setDemoScenarioId,
  };
}
