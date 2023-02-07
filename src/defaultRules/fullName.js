export default {
    name: 'fullName',
    parameter: null,
    message: 'Nome incompleto',
    async: false,
    fn: (value, parameter) => {
        let exp = /^(\w.+\s).+/;
        console.log('fullnamerule', value);
        return exp.test(value)
    }
}
