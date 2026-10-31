"""Forja IA — genera un modelo GGUF diminuto para las pruebas del motor local.

No es un modelo útil: arquitectura llama de 2 capas con pesos aleatorios (semilla
fija), así que responde texto sin sentido. Sirve para probar de verdad, sin
descargar nada, todo el camino del modelo local en el navegador: leer el
archivo, cargarlo en wllama, aplicar la plantilla de chat, generar en
streaming, parar por longitud o por fin de turno y cancelar.

Uso (necesita `pip install gguf numpy`):
    python scripts/gguf-de-prueba.py tests/fixtures/forja-diminuto.gguf
"""

import sys

import numpy as np
from gguf import GGUFWriter, TokenType

N_EMBD = 64
N_HEAD = 4
N_LAYER = 2
N_FF = 128
# Contexto declarado: el prompt de sistema de la app ya ocupa ~2.500 tokens.
N_CTX = 8192

CHATML = (
    "{% for message in messages %}"
    "{{ '<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n' }}"
    "{% endfor %}"
    "{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}"
)


def vocabulario():
    """SentencePiece con respaldo de bytes: cualquier texto se puede codificar."""
    tokens, scores, tipos = [], [], []

    def add(t, tipo, score=0.0):
        tokens.append(t)
        tipos.append(tipo)
        scores.append(score)

    add("<unk>", TokenType.UNKNOWN)
    add("<s>", TokenType.CONTROL)
    add("</s>", TokenType.CONTROL)
    for b in range(256):
        add(f"<0x{b:02X}>", TokenType.BYTE)
    # Piezas normales: el espacio de SentencePiece y las letras, para que la
    # salida tenga palabras y no solo bytes sueltos.
    add("▁", TokenType.NORMAL, -1.0)
    for c in "abcdefghijklmnopqrstuvwxyzáéíóúñ":
        add(c, TokenType.NORMAL, -2.0)
        add("▁" + c, TokenType.NORMAL, -2.5)
    add("<|im_start|>", TokenType.CONTROL)
    add("<|im_end|>", TokenType.CONTROL)
    return tokens, scores, tipos


def main(salida: str) -> None:
    rng = np.random.default_rng(1234)
    tokens, scores, tipos = vocabulario()
    n_vocab = len(tokens)
    im_end = tokens.index("<|im_end|>")

    w = GGUFWriter(salida, "llama")
    w.add_name("forja-diminuto (pruebas)")
    w.add_context_length(N_CTX)
    w.add_embedding_length(N_EMBD)
    w.add_block_count(N_LAYER)
    w.add_feed_forward_length(N_FF)
    w.add_head_count(N_HEAD)
    w.add_head_count_kv(N_HEAD)
    w.add_rope_dimension_count(N_EMBD // N_HEAD)
    w.add_layer_norm_rms_eps(1e-5)
    w.add_file_type(0)  # F32

    w.add_tokenizer_model("llama")
    w.add_token_list(tokens)
    w.add_token_scores(scores)
    w.add_token_types(tipos)
    w.add_bos_token_id(1)
    w.add_eos_token_id(im_end)
    w.add_unk_token_id(0)
    w.add_add_bos_token(False)
    w.add_chat_template(CHATML)

    def t(*shape, escala=0.08):
        return (rng.standard_normal(shape) * escala).astype(np.float32)

    # numpy va al revés que ggml: (filas, columnas) = (ne[1], ne[0])
    w.add_tensor("token_embd.weight", t(n_vocab, N_EMBD))
    for i in range(N_LAYER):
        w.add_tensor(f"blk.{i}.attn_norm.weight", np.ones(N_EMBD, dtype=np.float32))
        w.add_tensor(f"blk.{i}.attn_q.weight", t(N_EMBD, N_EMBD))
        w.add_tensor(f"blk.{i}.attn_k.weight", t(N_EMBD, N_EMBD))
        w.add_tensor(f"blk.{i}.attn_v.weight", t(N_EMBD, N_EMBD))
        w.add_tensor(f"blk.{i}.attn_output.weight", t(N_EMBD, N_EMBD))
        w.add_tensor(f"blk.{i}.ffn_norm.weight", np.ones(N_EMBD, dtype=np.float32))
        w.add_tensor(f"blk.{i}.ffn_gate.weight", t(N_FF, N_EMBD))
        w.add_tensor(f"blk.{i}.ffn_up.weight", t(N_FF, N_EMBD))
        w.add_tensor(f"blk.{i}.ffn_down.weight", t(N_EMBD, N_FF))
    w.add_tensor("output_norm.weight", np.ones(N_EMBD, dtype=np.float32))
    w.add_tensor("output.weight", t(n_vocab, N_EMBD))

    w.write_header_to_file()
    w.write_kv_data_to_file()
    w.write_tensors_to_file()
    w.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "forja-diminuto.gguf")
