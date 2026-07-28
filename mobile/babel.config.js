module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // WatermelonDB models use decorator syntax (@field, @date, @children, ...).
    plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]],
  };
};
