class FormValidatorStepsHandler {

    constructor(options) {

        this.steps = options.steps;
        this.currentStepIndex = undefined;
        this.onUpdate = options.onUpdate;
        this.onInit = options.onInit;
        this.enableStrictStepsOrder = options.enableStrictStepsOrder;
        this.submitFn = options.submitFn;
        this.onSubmit = options.onSubmit
        this.onSubmitFail = options.onSubmitFail;
        this.isSubmitting = false;
        this.currentStepClass = options.currentStepClass || "d-block"; // TODO: deixar configurável  
        this.hiddenStepClass = options.hiddenStepClass || "d-none" // TODO: deixar configurável  
        // this.onBeforeSetStep = options.onSetStep
        this.onSetStep = options.onSetStep

        return this.init()
    }

    init() {

        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            let $stepForm = step.formValidatorInstance.$form;

            let handleStepFormChange = (e) => {
                // this.update()
            }

            step.formValidatorInstance._onUpdate = () => {
                this.update()
            }

            if(step.formValidatorInstance && step.formValidatorInstance.$form) {
                $stepForm.addEventListener("change", handleStepFormChange);

                let _this = this;
                step.formValidatorInstance.submitFn = ((validator, cb) => {
                    _this.submit();
                    cb(false)
                })
            }

            let stepPreviousButtons = $stepForm.querySelectorAll('[data-steps-handler-previous]');
            let stepNextButtons = $stepForm.querySelectorAll('[data-steps-handler-next]');
            let submitButtons = $stepForm.querySelectorAll('[data-steps-handler-submit]');

            stepPreviousButtons.forEach($previousButton => {
                $previousButton.addEventListener('click', e => {
                    e.preventDefault();
                    this.previous()
                })
            })

            stepNextButtons.forEach($nextButton => {
                $nextButton.addEventListener('click', e => {
                    e.preventDefault();
                    this.next()
                })
            })

            submitButtons.forEach($submitButton => {
                $submitButton.addEventListener('click', e => {
                    e.preventDefault();
                    this.submit()
                })
            })

        }

        this.start(); // TODO: if config says it auto starts

        this.update();

        (this.onInit) && this.onInit(this);

        return this
        
    }


    update() {

        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            
            let status;
            let enabled;

            let stepValidator = step.formValidatorInstance;

            if(stepValidator.isValid()) {
                status = 1
            } else if(stepValidator.isValidating()) {
                status = -1
            } else {
                status = 0
            }
            
            if(typeof step.enabled === "function" && !step.enabled()) {
                enabled = true;
            } else {
                enabled = false
            }

            step._state = {
                active: (this.currentStepIndex === i),
                status: status,
                enabled: enabled
            };
            
        }
        
        (this.onUpdate) && this.onUpdate(this);
        
    }
    
    focusStepFirstNotValidField(stepIndex) {
        var firstNotValidField = this.steps[stepIndex].formValidatorInstance.getFirstNotValidField();
        if(firstNotValidField) {
            firstNotValidField.focus()
        }
        
    }

    setStep(stepIndex, focusStepFirstNotValidField=true) {    
        
        if(stepIndex < 0 || stepIndex >= this.steps.length || !this.steps[stepIndex]) {
            return;
        }
        let _this = this;
        let _setStep = () => {
            for(let i = 0; i < this.steps.length; i++) {
                let step = this.steps[i];
                step.formValidatorInstance.$form.classList.remove(this.currentStepClass);
                step.formValidatorInstance.$form.classList.add(this.hiddenStepClass);
            }
            
            this.steps[stepIndex].formValidatorInstance.$form.classList.remove(this.hiddenStepClass);
            this.steps[stepIndex].formValidatorInstance.$form.classList.add(this.currentStepClass);

            this.currentStepIndex = stepIndex;
            this.update()
        
            if(focusStepFirstNotValidField) {
                this.focusStepFirstNotValidField(this.currentStepIndex)
            }
            
            if(this.onSetStep) {
                this.onSetStep(_this)
            }
            return
        }

        this.steps[stepIndex].formValidatorInstance.$form.dispatchEvent(new CustomEvent('formValidatorShowStep', {detail: {currentStep: stepIndex}}))

        
        if(this.enableStrictStepsOrder) {
            
            let validatorsPromises = [];
            for(let i = stepIndex-1; i>=0; i--) {
                if(this.steps[i]) {
                    validatorsPromises.push(this.steps[i].formValidatorInstance._validate());
                }
            }

            Promise.all(validatorsPromises).then(() => {
                _setStep()
            }).catch(() => {
                this.steps[this.currentStepIndex].formValidatorInstance.submit()
                if(focusStepFirstNotValidField) {
                    this.focusStepFirstNotValidField(this.currentStepIndex)
                }
            })

            
        } else {
            _setStep()
        }

        return;

    }

    next() {
        this.steps[this.currentStepIndex].formValidatorInstance._validate().then(() => {
            if(this.currentStepIndex < this.steps.length-1) {
                this.setStep(this.currentStepIndex + 1);
            }
        }).catch(() => {
            this.submit()
        })

        return;
    }

    previous() {
        this.setStep(this.currentStepIndex - 1);
    }

    reset() {
        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            step.formValidatorInstance.resetForm();
        }
        this.start();
    }

    start() {
        this.setStep(0, false);
    }


    submit() {

        if(this.isSubmitting) {
            return;
        }
        
        let firstInvalidStepIndex = -1;
        for(let i = 0; i < this.steps.length; i++) {
            let step = this.steps[i];
            if(!step.formValidatorInstance.isValid()) {
                firstInvalidStepIndex = i;
                break;
            }
        }

        if(firstInvalidStepIndex !== -1) {
            this.setStep(firstInvalidStepIndex);
            this.steps[firstInvalidStepIndex].formValidatorInstance.validate().then(() => {
                this.submit();
            }).catch(() => {})
        } else {
            
            let _this = this;
            let submitCallback = (result) => {

                _this.isSubmitting = false;
                if(result) {
                    _this.onSubmit(_this);
                    // _this.reset();
                } else {
                    _this.onSubmitFail(_this);
                }
            }
            this.isSubmitting = true;

            
            // let forms = this.steps.map((step) => { 
            //     return step.formValidatorInstance.$form
            // });

            (this.submitFn) && this.submitFn(this, submitCallback);

        }
        
        

    }


}

export default FormValidatorStepsHandler