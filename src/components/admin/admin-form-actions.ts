export type AdminFormAction = (formData: FormData) => void | Promise<void>;

export type AdminCompanyFormActions = {
  createCompanyAction: AdminFormAction;
  updateCompanyAction: AdminFormAction;
  deleteCompanyAction: AdminFormAction;
  updateConnectionAction: AdminFormAction;
  createAccountAction: AdminFormAction;
  updateAccountAction: AdminFormAction;
  createSetupUrlAction: AdminFormAction;
  sendSetupUrlAction: AdminFormAction;
};
