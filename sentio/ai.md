
# prompt intro


<context>
  <summary>
    The goal is to transform our data, currenty stored in an SQL database into a standardized format that follows the sentio specifications.
  </summary>
  <availableTools>
    - Given SQL access to the given @schema.graphql schema where each type is accessible as a standard SQL table and relations are accessible though join.
    - the id of the relation is available as the relation name. Example: do NOT use `table.relation.id`, use `table.relation`.
    - you have access to clickhouse functions and should write in clickhouse SQL format
    - escape names with backticks
    - use `toDecimal256(col, 18) / pow(10, token_decimals)` to convert BigInt to numbers. USD prices are assumed to have 18 decimals.
    - example: `toDecimal256(any(p.underlying_token_amount_str), 18) / pow(10, underlying_token_decimals) as underlying_token_amount`
    - use `array*` functions to deal with arrays (`arrayZip`, `arrayMap`, `arrayJoin`, etc)
    - use `JSONExtract(col, 'Array(String)')` to extract data from columns of BigInt[]
    - enums column names are postfixed with `__`. Exeample: `type: ClassicPositionInteractionType!` -> `column name: type__`
    - convert timestamps with `fromUnixTimestamp(toInt64(col))`
  </availableTools>

  <resources>
    - Requirements: https://github.com/delta-hq/schemas/blob/main/schemas/general/SCHEMA.md
    - FAQ: https://openblock.notion.site/Onboarding-FAQs-571951f8ecff4e7ca927fab4e27e8401
    - clickhouse docs:
      - https://clickhouse.com/docs/en/sql-reference/functions/array-functions#arrayzip
      - https://clickhouse.com/docs/en/sql-reference/functions/array-join
    - Schema: @schema.graphql
  </resources>
</context>

