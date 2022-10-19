

export default {

    name: 'fullName',
    parameter: null,
    message: "Nome incompleto",
    async: false,
    fn: (value) => {
        var fullNameRegex = /^([a-zA-Z]{2,}\s[a-zA-Z]{1,}'?-?[a-zA-Z]{2,}\s?([a-zA-Z]{1,})?)/
        return fullNameRegex.test(value) || !value.length
    }

}