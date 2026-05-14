export interface StateMachine {
  arn: string;
  name: string;
  displayName: string;
  totalStates: number | null;
  consoleUrl: string;
}

export interface CurrentStep {
  name: string | null;
  transitioning: boolean;
}

export interface Phase {
  name: string;
  index: number;
  total: number;
}

interface ExecutionBase {
  executionArn: string;
  executionName: string;
  stateMachineArn: string;
  stateMachineName: string;
  stateMachineDisplayName: string;
  status: string;
  startDate: string;
  startEpoch: number;
  stepIndex: number | null;
  totalSteps: number | null;
  phase: Phase | null;
  projectId: string | null;
  projectName: string | null;
  processGroupId: string | null;
  redriveCount: number;
  redriveDate: string | null;
  input: string | null;
  consoleUrl: string;
}

export interface RunningExecution extends ExecutionBase {
  currentStep: CurrentStep | null;
}

export interface FailedExecution extends ExecutionBase {
  stopDate: string | null;
  stopEpoch: number | null;
  failedStep: string | null;
  mapIteration: number | null;
  errorType: string | null;
  errorMessage: string | null;
}

export interface SucceededExecution extends ExecutionBase {
  stopDate: string | null;
  stopEpoch: number | null;
}
