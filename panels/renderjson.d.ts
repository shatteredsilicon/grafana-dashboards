/**
 * A TypeScript definition file for renderjson.js.
 * @see https://github.com/caldwell/renderjson
 */
declare function renderjson(json: any): HTMLPreElement;

declare namespace renderjson {
  /**
   * Sets the icons used for expanding and collapsing the rendered JSON.
   * @param show The icon for expanding.
   * @param hide The icon for collapsing.
   * @returns The `renderjson` object for chaining.
   */
  function set_icons(show: string, hide: string): typeof renderjson;

  /**
   * Sets the initial level of expansion.
   * @param level The number of levels to expand. Use "all" to expand everything.
   * @returns The `renderjson` object for chaining.
   */
  function set_show_to_level(level: number | 'all'): typeof renderjson;

  /**
   * Sets the maximum length for strings before they are truncated.
   * @param length The maximum length. Use "none" for no truncation.
   * @returns The `renderjson` object for chaining.
   */
  function set_max_string_length(length: number | 'none'): typeof renderjson;

  /**
   * Toggles whether object keys should be sorted alphabetically.
   * @param sort_bool True to sort keys, false otherwise.
   * @returns The `renderjson` object for chaining.
   */
  function set_sort_objects(sort_bool: boolean): typeof renderjson;

  /**
   * Sets a replacer function, similar to JSON.stringify's replacer.
   * @param replacer A function that alters the behavior of the stringification process.
   * @returns The `renderjson` object for chaining.
   */
  function set_replacer(replacer: (key: string, value: any) => any): typeof renderjson;

  /**
   * Sets the message displayed when an object is collapsed.
   * @param collapse_msg A function that takes the length of the collapsed object and returns a string.
   * @returns The `renderjson` object for chaining.
   */
  function set_collapse_msg(collapse_msg: (len: number) => string): typeof renderjson;

  /**
   * Sets a property list to control which properties are included, similar to JSON.stringify's replacer array.
   * @param prop_list An array of strings or numbers that serve as a whitelist for selecting properties.
   * @returns The `renderjson` object for chaining.
   */
  function set_property_list(prop_list: (string | number)[]): typeof renderjson;

  /**
   * Backwards compatibility method. Use set_show_to_level() for new code.
   * @deprecated
   */
  function set_show_by_default(show: boolean): typeof renderjson;

  /**
   * The options object used for rendering.
   */
  var options: {
    show: string;
    hide: string;
    show_to_level: number;
    max_string_length: number;
    sort_objects: boolean;
    replacer: (key: string, value: any) => any | undefined;
    property_list: (string | number)[] | undefined;
    collapse_msg: (len: number) => string;
  };
}

export = renderjson;
