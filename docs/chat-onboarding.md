# Configurar PoXter desde un chat de Codex

Abre el clon en Codex y pide: **«Configura este PoXter conmigo, incluida mi cuenta de Buffer»**. Codex ejecuta los pasos locales, pregunta por tus marcas y te da una pantalla privada para introducir la clave. No hace publicaciones de prueba.

## 1. Preparar el clon

Codex ejecuta dentro del repositorio, en Linux, macOS o WSL:

```bash
bash scripts/onboarding/bootstrap.sh
corepack pnpm onboard status
```

El primer comando instala las dependencias bloqueadas, genera el cliente Prisma y prepara SQLite. Si falta, crea `$HOME/.config/poxter/env` con una base local y acceso web limitado al propio equipo. Conserva cualquier archivo de configuración o base existente. El estado indica si se está usando la marca de ejemplo.

## 2. Configurar marcas

Da a Codex el nombre, un slug en minúsculas y la zona horaria de cada marca. Por ejemplo:

```bash
corepack pnpm onboard brand --slug mi-marca --name "Mi Marca" --timezone Europe/Madrid
```

Las marcas se guardan en `$HOME/.config/poxter/brands.local.json`, fuera del repositorio. El comando actualiza la marca si ya existe y mantiene las demás. PoXter usa X como plataforma de los borradores manuales actuales.

## 3. Conectar Buffer

Si aún no tienes clave, créala en [Buffer → Ajustes → API](https://publish.buffer.com/settings/api). Para este flujo personal necesitas acceso de lectura a la cuenta y escritura de publicaciones; [Buffer documenta la creación y permisos de la clave](https://support.buffer.com/en-us/articles/how-to-create-your-buffer-api-key-ShIgYVwM6j). Si no aparece la opción API, comprueba que tu correo esté verificado y que tengas permisos de propietario de la organización.

Codex inicia la pantalla privada con la herramienta MCP `start_buffer_key_setup`, si ya está cargada. En el primer chat tras clonar, puede ejecutar:

```bash
corepack pnpm onboard buffer
```

El comando imprime un enlace `http://127.0.0.1:.../`. Abre ese enlace en el mismo equipo e introduce allí la clave. PoXter verifica la conexión con Buffer antes de guardarla en `$HOME/.config/poxter/env` con permisos privados. La clave no pasa por el chat ni se muestra en la respuesta. Si Buffer la rechaza, la pantalla permite volver a intentarlo y no sustituye una clave anterior.

Después, Codex obtiene los canales y te presenta una lista numerada de nombres, plataformas y organizaciones:

```bash
corepack pnpm onboard channels
```

Elige un canal para cada marca. Codex registra las elecciones por número:

```bash
corepack pnpm onboard map --brand mi-marca --channel 1
corepack pnpm onboard status
```

El número corresponde a la lista recién obtenida. Si no aparece ningún canal, conecta uno a tu cuenta de Buffer y vuelve a ejecutar `onboard channels`. Si cambias la clave mientras la web de PoXter está abierta, reinicia la web para que cargue el nuevo valor.

## 4. Conectar el MCP a Codex

Codex comprueba primero `codex mcp get poxter`. Si no existe, en Linux o macOS registra la ruta absoluta del clon:

```bash
codex mcp add poxter -- bash /ruta/absoluta/poxter/scripts/mcp/poxter-mcp.sh
```

Cuando Codex Desktop corre en Windows y el clon está en WSL, registra el lanzador desde PowerShell con la distribución y ruta reales:

```powershell
codex mcp add poxter -- C:\Windows\System32\wsl.exe -d Ubuntu-22.04 -- bash /home/usuario/projects/poxter/scripts/mcp/poxter-mcp.sh
```

Codex verifica `codex mcp get poxter` y vuelve a consultar `onboard status`. Si ya existe una configuración `poxter` que apunta a otro clon, debe mostrar la diferencia antes de sustituirla. Abre un chat nuevo para que Codex cargue las herramientas MCP registradas. Puedes pedir entonces: **«Muéstrame mis marcas y borradores de PoXter»**.

## Comprobación final

El estado debe indicar `databaseReady: true`, marcas reales en `brandRegistry`, `buffer.configured: true` y un mapeo por marca que vaya a programar. `readyForBufferScheduling: true` confirma la configuración local; la clave se verifica con una consulta de lectura y los canales se recuperan de Buffer. Programar borradores sigue siendo una acción separada y explícita.
