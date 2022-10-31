const INITIALIZED_FIELD_DATA_ATTRIBUTE = 'data-form-validator-initialized-field';
const GROUP_WRAPPER_DATA_ATTRIBUTE = 'data-form-validator-group-wrapper';
const REPEATABLE_WRAPPER_DATA_ATTRIBUTE = 'data-form-validator-repeatable-wrapper';
const REPEATABLE_LIMIT_DATA_ATTRIBUTE = 'data-form-validator-repeatable-limit';
const REPEATABLE_ITEM_DATA_ATTRIBUTE = 'data-form-validator-repeatable-item';

const DEFAULT_OPTIONS = {

    debug: false,
    enableDataRestore: false, // will be deleted on form submission or reset

    resetFieldValidationOnChange: true,
    validateFieldOnInput: false,
    validateFieldOnBlur: true,
    validateFieldOnChange: false, // may be used for mocked elements (that use hidden fields)

    formDisabledClass: "disabled",
    formEnabledClass: "",

    groupWrapperHiddenClass: "d-none",
    groupWrapperVisibleClass: "d-block",

    fieldRenderPreferences: {
        wrapperClass: "form-group",
        wrapperHiddenClass: "d-none",
        wrapperVisibleClass: "d-block",
        wrapperDisabledClass: "disabled",

        messageWrapperNode: undefined, //Render message somewhere else

        disabledClass: "disabled",
        
        // "Unvalidated" field state 
        showUnvalidatedMessage: false,
        unvalidatedMessage: "Unvalidated",
        unvalidatedMessageHTML: "<div class=\"valid-feedback text-muted d-block\">{{message}}</div>",
        addUnvalidatedClass: true,
        unvalidatedClass: "is-unvalidated",
        addWrapperUnvalidatedClass: true,
        wrapperUnvalidatedClass: "is-unvalidated",
        messageUnvalidatedClass: "is-unvalidated",

        // "Validating" field state
        showValidatingMessage: true,
        validatingMessage: "Validating...",
        validatingMessageHTML: "<div class=\"valid-feedback text-muted d-block\">{{message}}</div>",
        addValidatingClass: true,
        validatingClass: "is-validating",
        addWrapperValidatingClass: true,
        wrapperValidatingClass: "is-validating",
        messageValidatingClass: "is-validating",

        // "Invalid" field state (message will come from first unmatched rule)
        showInvalidMessage: true,
        invalidMessageHTML: "<div class=\"invalid-feedback text-danger d-block\">{{message}}</div>",
        addInvalidClass: true,
        invalidClass: "is-invalid",
        addWrapperInvalidClass: true,
        wrapperInvalidClass: "is-invalid",
        messageInvalidClass: "is-invalid",
        
        // "Valid" field state
        showValidMessage: true,
        validMessage: "Field is valid",
        validMessageHTML: "<div class=\"valid-feedback text-success d-block\">{{message}}</div>",
        addValidClass: true,
        validClass: "is-valid",
        addWrapperValidClass: true,
        wrapperValidClass: "is-valid"
        
    },
    
    fields: [
    ],


    showLoadingFn: undefined, // returns instance
    hideLoadingFn: undefined, // returns instance
    submitFn: undefined, // returns instance

    events: {   
        onInit: undefined,
        onBeforeReset: undefined,
        onReset: undefined,
        onTrySubmit: undefined,
        onBeforeSubmit: undefined,
        onSubmitFail: undefined,
        onSubmit: undefined,
        onBeforeValidate: undefined,
        onValidate: undefined,
        onBeforeValidateField: undefined,
        onValidateField: undefined,
        onFieldInput: undefined,
        onBeforeShowDependentFields: undefined,
        onShowDependentFields: undefined,
        onBeforeHideDependentFields: undefined,
        onHideDependentFields: undefined
    }

} 

export default {
    INITIALIZED_FIELD_DATA_ATTRIBUTE,
    GROUP_WRAPPER_DATA_ATTRIBUTE,
    DEFAULT_OPTIONS,
    REPEATABLE_WRAPPER_DATA_ATTRIBUTE,
    REPEATABLE_LIMIT_DATA_ATTRIBUTE,
    REPEATABLE_ITEM_DATA_ATTRIBUTE
}