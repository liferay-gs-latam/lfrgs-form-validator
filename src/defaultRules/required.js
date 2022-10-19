export default {

    name: 'required',
    parameter: null,
    message: "Campo obrigatório",
    async: false,
    fn: (value, parameter) => {

        if(parameter && parameter.length > 0) {
            if(parameter === "money") {
                return (value && value.length > 0 && value != "0" && value != "0,00")
            }
            return (value && value.length > 0 && value !== parameter)
        }

        return (value && value.length > 0)

    }

}